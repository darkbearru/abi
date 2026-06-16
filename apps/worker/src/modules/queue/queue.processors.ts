import { randomInt } from 'node:crypto';
import { Readable } from 'node:stream';

import { AiProviderRegistry } from '@abi/ai-core';
import { BookParserService } from '@abi/book-parser';
import { StorageService } from '@abi/storage';
import { InjectQueue, OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Queue, type Job } from 'bullmq';

import { CharacterExtractionService } from '../character-extraction/character-extraction.service.js';
import { LocationExtractionService } from '../location-extraction/location-extraction.service.js';
import { TimelineExtractionService } from '../timeline-extraction/timeline-extraction.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  DEFAULT_BACKOFF_DELAY_MS,
  DEFAULT_JOB_ATTEMPTS,
  type QueueName
} from './queue.constants.js';
import { createWorkerBookChunks } from './book-analysis-chunker.js';
import { TrackedQueueProcessor } from './tracked-queue.processor.js';

type QueueJob = Job<Record<string, unknown>>;

@Processor('book-analysis')
class BookAnalysisProcessor extends TrackedQueueProcessor {
  constructor(
    @Inject(PrismaService)
    prisma: PrismaService,
    @Inject(BookParserService)
    private readonly bookParser: BookParserService,
    @Inject(StorageService)
    private readonly storage: StorageService,
    @InjectQueue('chunk-extraction')
    private readonly chunkExtractionQueue: Queue
  ) {
    super(prisma, 'book-analysis');
  }

  protected override async handle(job: QueueJob): Promise<Prisma.InputJsonObject> {
    const generationJobId = requireString(job.data.generationJobId, 'generationJobId');
    const bookId = requireString(job.data.bookId, 'bookId');
    const analysisId = requireString(job.data.analysisId, 'analysisId');
    const projectId = getString(job.data.projectId);
    const userId = getString(job.data.userId);

    await this.prisma.bookAnalysis.update({
      where: { id: analysisId },
      data: { status: 'PROCESSING' }
    });

    const sourceFile = await this.prisma.bookFile.findFirst({
      where: { bookId, kind: 'ORIGINAL' },
      orderBy: { createdAt: 'desc' }
    });

    if (!sourceFile) {
      throw new Error(`Book "${bookId}" does not have an original file.`);
    }

    const fileBytes = await readStream(this.storage.read(sourceFile.localPath));
    const parsed = await this.bookParser.parse(fileBytes, {
      filename: sourceFile.localPath,
      mimeType: sourceFile.mimeType
    });
    const chunks = createWorkerBookChunks({
      bookId,
      bookAnalysisId: analysisId,
      normalizedText: parsed.normalizedText,
      chapters: parsed.chapters,
      targetTokenCount: getPositiveInt(process.env.BOOK_CHUNK_TARGET_TOKENS, 1800),
      overlapTokenCount: getPositiveInt(process.env.BOOK_CHUNK_OVERLAP_TOKENS, 200)
    });

    await updateProgress(this.prisma, job, generationJobId, 45);

    await this.prisma.$transaction(async (tx) => {
      await tx.bookChunk.deleteMany({
        where: {
          bookId,
          bookAnalysisId: analysisId
        }
      });

      if (chunks.length > 0) {
        await tx.bookChunk.createMany({
          data: chunks.map((chunk) => ({
            id: chunk.id,
            bookId: chunk.bookId,
            bookAnalysisId: chunk.bookAnalysisId,
            chapterIndex: chunk.chapterIndex,
            text: chunk.text,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            tokenEstimate: chunk.tokenEstimate,
            orderIndex: chunk.orderIndex
          }))
        });
      }

      await tx.bookAnalysis.update({
        where: { id: analysisId },
        data: {
          status: chunks.length === 0 ? 'FAILED' : 'PROCESSING',
          metadata: {
            title: parsed.metadata.title,
            author: parsed.metadata.author,
            language: parsed.metadata.language,
            chapterCount: parsed.chapters.length,
            chunkCount: chunks.length
          }
        }
      });
    });

    if (chunks.length === 0) {
      throw new Error(`Book analysis "${analysisId}" produced no chunks.`);
    }

    const extractionJob = await createTrackedJob({
      prisma: this.prisma,
      queue: this.chunkExtractionQueue,
      queueName: 'chunk-extraction',
      name: 'extract-analysis-chunks',
      ...(projectId === undefined ? {} : { projectId }),
      ...(userId === undefined ? {} : { userId }),
      bookAnalysisId: analysisId,
      payload: {
        bookId,
        analysisId,
        ...(projectId === undefined ? {} : { projectId }),
        ...(userId === undefined ? {} : { userId })
      }
    });

    return {
      bookId,
      analysisId,
      chunkCount: chunks.length,
      extractionJobId: extractionJob.id
    };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: QueueJob, error: Error): Promise<void> {
    await this.handleFailed(job, error);
    await markAnalysisFailed(this.prisma, getString(job.data.analysisId), error);
  }
}

@Processor('chunk-extraction')
class ChunkExtractionProcessor extends TrackedQueueProcessor {
  constructor(
    @Inject(PrismaService)
    prisma: PrismaService,
    @Inject(CharacterExtractionService)
    private readonly characters: CharacterExtractionService,
    @Inject(LocationExtractionService)
    private readonly locations: LocationExtractionService,
    @Inject(TimelineExtractionService)
    private readonly timeline: TimelineExtractionService,
    @InjectQueue('entity-merge')
    private readonly entityMergeQueue: Queue
  ) {
    super(prisma, 'chunk-extraction');
  }

  protected override async handle(job: QueueJob): Promise<Prisma.InputJsonObject> {
    const generationJobId = requireString(job.data.generationJobId, 'generationJobId');
    const bookId = requireString(job.data.bookId, 'bookId');
    const analysisId = requireString(job.data.analysisId, 'analysisId');
    const projectId = getString(job.data.projectId);
    const userId = getString(job.data.userId);
    const requestedChunkId = getString(job.data.chunkId);
    const chunks =
      requestedChunkId === undefined
        ? await this.prisma.bookChunk.findMany({
            where: { bookId, bookAnalysisId: analysisId },
            orderBy: { orderIndex: 'asc' },
            select: { id: true }
          })
        : [{ id: requestedChunkId }];
    let characterFactCount = 0;
    let locationFactCount = 0;
    let timelineFactCount = 0;

    if (chunks.length === 0) {
      throw new Error(`No chunks found for book analysis "${analysisId}".`);
    }

    for (const [index, chunk] of chunks.entries()) {
      const input = { bookId, analysisId, chunkId: chunk.id };
      const [characterFacts, locationFacts, timelineFacts] = await Promise.all([
        this.characters.processChunk(input),
        this.locations.processChunk(input),
        this.timeline.processChunk(input)
      ]);

      characterFactCount += characterFacts.length;
      locationFactCount += locationFacts.length;
      timelineFactCount += timelineFacts.length;

      await updateProgress(
        this.prisma,
        job,
        generationJobId,
        Math.min(95, Math.round(((index + 1) / chunks.length) * 95))
      );
    }

    const mergeJob =
      requestedChunkId === undefined
        ? await createTrackedJob({
            prisma: this.prisma,
            queue: this.entityMergeQueue,
            queueName: 'entity-merge',
            name: 'merge-analysis-entities',
            ...(projectId === undefined ? {} : { projectId }),
            ...(userId === undefined ? {} : { userId }),
            bookAnalysisId: analysisId,
            payload: {
              bookId,
              analysisId,
              ...(projectId === undefined ? {} : { projectId }),
              ...(userId === undefined ? {} : { userId })
            }
          })
        : undefined;

    return {
      bookId,
      analysisId,
      chunkCount: chunks.length,
      characterFactCount,
      locationFactCount,
      timelineFactCount,
      ...(mergeJob === undefined ? {} : { mergeJobId: mergeJob.id })
    };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: QueueJob, error: Error): Promise<void> {
    await this.handleFailed(job, error);
    await markAnalysisFailed(this.prisma, getString(job.data.analysisId), error);
  }
}

@Processor('entity-merge')
class EntityMergeProcessor extends TrackedQueueProcessor {
  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @InjectQueue('vector-indexing')
    private readonly vectorIndexingQueue: Queue,
    @InjectQueue('graph-sync')
    private readonly graphSyncQueue: Queue
  ) {
    super(prisma, 'entity-merge');
  }

  protected override async handle(job: QueueJob): Promise<Prisma.InputJsonObject> {
    const generationJobId = requireString(job.data.generationJobId, 'generationJobId');
    const analysisId = requireString(job.data.analysisId, 'analysisId');
    const projectId = requireString(job.data.projectId, 'projectId');
    const userId = await requireProjectUserId(
      this.prisma,
      projectId,
      getString(job.data.userId)
    );
    const factCount = await this.prisma.extractedFact.count({
      where: { bookAnalysisId: analysisId }
    });
    const worldBible = await ensureProjectWorldBible(this.prisma, projectId, analysisId);

    await updateProgress(this.prisma, job, generationJobId, 45);

    await this.prisma.bookAnalysis.update({
      where: { id: analysisId },
      data: {
        status: 'COMPLETED',
        metadata: mergeMetadata(await getBookAnalysisMetadata(this.prisma, analysisId), {
          extractionFactCount: factCount,
          worldBibleId: worldBible.id,
          mergeStatus: 'ORCHESTRATED'
        })
      }
    });

    const [vectorJob, graphJob] = await Promise.all([
      createTrackedJob({
        prisma: this.prisma,
        queue: this.vectorIndexingQueue,
        queueName: 'vector-indexing',
        name: 'index-project-vectors',
        projectId,
        userId,
        bookAnalysisId: analysisId,
        payload: {
          projectId,
          analysisId,
          userId
        }
      }),
      createTrackedJob({
        prisma: this.prisma,
        queue: this.graphSyncQueue,
        queueName: 'graph-sync',
        name: 'sync-project-graph',
        projectId,
        userId,
        bookAnalysisId: analysisId,
        payload: {
          projectId,
          analysisId,
          userId
        }
      })
    ]);

    await updateProgress(this.prisma, job, generationJobId, 95);

    return {
      projectId,
      analysisId,
      worldBibleId: worldBible.id,
      factCount,
      vectorJobId: vectorJob.id,
      graphJobId: graphJob.id
    };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: QueueJob, error: Error): Promise<void> {
    await this.handleFailed(job, error);
    await markAnalysisFailed(this.prisma, getString(job.data.analysisId), error);
  }
}

@Processor('vector-indexing')
class VectorIndexingProcessor extends TrackedQueueProcessor {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma, 'vector-indexing');
  }

  protected override async handle(job: QueueJob): Promise<Prisma.InputJsonObject> {
    const generationJobId = requireString(job.data.generationJobId, 'generationJobId');
    const projectId = requireString(job.data.projectId, 'projectId');
    const analysisId = getString(job.data.analysisId);
    const chunkCount = await this.prisma.bookChunk.count({
      where: analysisId === undefined ? { bookAnalysis: { projects: { some: { id: projectId } } } } : { bookAnalysisId: analysisId }
    });

    await updateProgress(this.prisma, job, generationJobId, 100);

    return {
      projectId,
      ...(analysisId === undefined ? {} : { analysisId }),
      indexedEntityCount: chunkCount,
      mode: 'metadata-only'
    };
  }

  @OnWorkerEvent('failed')
  onFailed(job: QueueJob, error: Error): Promise<void> {
    return this.handleFailed(job, error);
  }
}

@Processor('graph-sync')
class GraphSyncProcessor extends TrackedQueueProcessor {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma, 'graph-sync');
  }

  protected override async handle(job: QueueJob): Promise<Prisma.InputJsonObject> {
    const generationJobId = requireString(job.data.generationJobId, 'generationJobId');
    const projectId = requireString(job.data.projectId, 'projectId');
    const worldBible = await findProjectWorldBible(this.prisma, projectId);

    await updateProgress(this.prisma, job, generationJobId, 100);

    return {
      projectId,
      ...(worldBible === undefined ? {} : { worldBibleId: worldBible.id }),
      mode: 'metadata-only'
    };
  }

  @OnWorkerEvent('failed')
  onFailed(job: QueueJob, error: Error): Promise<void> {
    return this.handleFailed(job, error);
  }
}

@Processor('image-generation')
export class ImageGenerationProcessor extends TrackedQueueProcessor {
  constructor(
    @Inject(PrismaService)
    prisma: PrismaService,
    @Inject(AiProviderRegistry)
    private readonly aiProviders: AiProviderRegistry,
    @Inject(StorageService)
    private readonly storage: StorageService,
    @InjectQueue('image-validation')
    private readonly imageValidationQueue: Queue
  ) {
    super(prisma, 'image-generation');
  }

  protected override async handle(job: QueueJob): Promise<Prisma.InputJsonObject> {
    const generationJobId = requireString(job.data.generationJobId, 'generationJobId');
    const prompt = requireString(job.data.prompt, 'prompt');
    const sceneId = requireString(job.data.sceneId, 'sceneId');
    const projectId = getString(job.data.projectId);
    const userId =
      getString(job.data.userId) ??
      (projectId === undefined ? undefined : await resolveProjectUserId(this.prisma, projectId));
    const providerId = getString(job.data.providerId) ?? process.env.SCENE_IMAGE_PROVIDER ?? 'openai';
    const model = getString(job.data.model);
    const size = getString(job.data.size) ?? process.env.SCENE_IMAGE_SIZE ?? '1024x1024';
    const seed = getNumber(job.data.seed) ?? createSeed(sceneId);

    await updateProgress(this.prisma, job, generationJobId, 25);

    const response = await this.aiProviders.generateImage(providerId, {
      prompt,
      ...(model === undefined ? {} : { model }),
      size,
      count: 1,
      metadata: {
        generationJobId,
        purpose: 'scene-generation',
        tags: ['scene', sceneId, ...(projectId === undefined ? [] : [projectId])]
      }
    });
    const image = response.images[0];

    if (!image) {
      throw new Error(`Image provider "${providerId}" returned no images.`);
    }

    await updateProgress(this.prisma, job, generationJobId, 60);

    const mimeType = image.mimeType ?? 'image/png';
    const imageBytes = await readGeneratedImageBytes(image);
    const stored = await this.storage.putObject({
      key: buildSceneAssetKey(sceneId, seed, mimeType),
      body: imageBytes,
      contentType: mimeType
    });
    const asset = await this.prisma.asset.create({
      data: {
        ...(projectId === undefined ? {} : { projectId }),
        sceneId,
        jobId: generationJobId,
        type: 'GENERATED',
        approvalStatus: 'DRAFT',
        localPath: stored.key,
        mimeType,
        prompt,
        seed,
        ...(response.model === undefined ? {} : { model: response.model }),
        provider: response.providerId,
        entityType: 'SCENE',
        entityId: sceneId,
        metadata: toJsonObject({
          negativePrompt: getString(job.data.negativePrompt),
          visualStyleId: getString(job.data.visualStyleId),
          aspectRatio: getString(job.data.aspectRatio),
          characterIds: getStringArray(job.data.characterIds),
          characterVersionIds: getStringArray(job.data.characterVersionIds),
          locationIds: getStringArray(job.data.locationIds),
          locationVersionIds: getStringArray(job.data.locationVersionIds),
          objectIds: getStringArray(job.data.objectIds),
          referenceAssetIds: getStringArray(job.data.referenceAssetIds)
        })
      }
    });

    await this.prisma.scene.update({
      where: { id: sceneId },
      data: {
        status: 'COMPLETED'
      }
    });

    const validationJob = await createTrackedJob({
      prisma: this.prisma,
      queue: this.imageValidationQueue,
      queueName: 'image-validation',
      name: 'validate-generated-image',
      ...(projectId === undefined ? {} : { projectId }),
      ...(userId === undefined ? {} : { userId }),
      sceneId,
      payload: {
        assetId: asset.id,
        sceneId,
        ...(projectId === undefined ? {} : { projectId }),
        ...(userId === undefined ? {} : { userId })
      }
    });

    await updateProgress(this.prisma, job, generationJobId, 90);

    return {
      assetIds: [asset.id],
      sceneId,
      validationJobId: validationJob.id,
      providerId: response.providerId,
      ...(response.model === undefined ? {} : { model: response.model })
    };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: QueueJob, error: Error): Promise<void> {
    await this.handleFailed(job, error);

    const sceneId = getString(job.data.sceneId);

    if (sceneId) {
      await this.prisma.scene.update({
        where: { id: sceneId },
        data: { status: 'FAILED' }
      });
    }
  }
}

@Processor('image-validation')
class ImageValidationProcessor extends TrackedQueueProcessor {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma, 'image-validation');
  }

  protected override async handle(job: QueueJob): Promise<Prisma.InputJsonObject> {
    const generationJobId = requireString(job.data.generationJobId, 'generationJobId');
    const assetId = requireString(job.data.assetId, 'assetId');
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, metadata: true }
    });

    if (!asset) {
      throw new Error(`Asset "${assetId}" was not found.`);
    }

    const result = {
      passed: true,
      score: 1,
      checks: [],
      recommendedAction: 'manual_review'
    };

    await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        metadata: mergeMetadata(asset.metadata, {
          consistencyValidation: result
        })
      }
    });
    await updateProgress(this.prisma, job, generationJobId, 100);

    return {
      assetId,
      result
    };
  }

  @OnWorkerEvent('failed')
  onFailed(job: QueueJob, error: Error): Promise<void> {
    return this.handleFailed(job, error);
  }
}

export const queueProcessors = [
  BookAnalysisProcessor,
  ChunkExtractionProcessor,
  EntityMergeProcessor,
  VectorIndexingProcessor,
  GraphSyncProcessor,
  ImageGenerationProcessor,
  ImageValidationProcessor
] as const;

async function updateProgress(
  prisma: PrismaService,
  job: QueueJob,
  generationJobId: string,
  progress: number
): Promise<void> {
  await job.updateProgress(progress);
  await prisma.generationJob.update({
    where: { id: generationJobId },
    data: { progress }
  });
}

async function readGeneratedImageBytes(image: {
  readonly b64Json?: string;
  readonly url?: string;
}): Promise<Uint8Array> {
  if (image.b64Json) {
    return Uint8Array.from(Buffer.from(stripDataUrlPrefix(image.b64Json), 'base64'));
  }

  if (image.url) {
    const response = await fetch(image.url);

    if (!response.ok) {
      throw new Error(`Unable to fetch generated image URL: ${String(response.status)}.`);
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  throw new Error('Generated image does not contain b64Json or url data.');
}

function stripDataUrlPrefix(value: string): string {
  const marker = 'base64,';
  const markerIndex = value.indexOf(marker);

  return markerIndex === -1 ? value : value.slice(markerIndex + marker.length);
}

function buildSceneAssetKey(sceneId: string, seed: number, mimeType: string): string {
  return `scenes/${sceneId}/${String(seed)}${extensionFromMime(mimeType)}`;
}

function extensionFromMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/svg+xml':
      return '.svg';
    case 'image/png':
    default:
      return '.png';
  }
}

function createSeed(sceneId: string): number {
  const base = Array.from(sceneId).reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return (base + randomInt(1, 1_000_000_000)) % 1_000_000_000;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Queue job is missing required "${name}" string.`);
  }

  return value;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function toJsonObject(input: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Prisma.InputJsonObject;
}

async function readStream(streamPromise: Promise<Readable>): Promise<Buffer> {
  const stream = await streamPromise;
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(toBufferChunk(chunk));
  }

  return Buffer.concat(chunks);
}

function toBufferChunk(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }

  if (typeof chunk === 'string' || chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }

  throw new Error('Storage stream emitted an unsupported chunk type.');
}

async function createTrackedJob(input: {
  readonly prisma: PrismaService;
  readonly queue: Queue;
  readonly queueName: QueueName;
  readonly name: string;
  readonly payload: Record<string, unknown>;
  readonly projectId?: string;
  readonly userId?: string;
  readonly sceneId?: string;
  readonly bookAnalysisId?: string;
}): Promise<{ readonly id: string }> {
  const userId =
    input.userId ??
    (input.projectId === undefined
      ? undefined
      : await resolveProjectUserId(input.prisma, input.projectId));

  if (input.projectId === undefined && userId === undefined) {
    throw new Error('Tracked queue jobs must include projectId or userId.');
  }

  const generationJob = await input.prisma.generationJob.create({
    data: {
      ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      ...(userId === undefined ? {} : { userId }),
      ...(input.sceneId === undefined ? {} : { sceneId: input.sceneId }),
      ...(input.bookAnalysisId === undefined ? {} : { bookAnalysisId: input.bookAnalysisId }),
      status: 'QUEUED',
      progress: 0,
      input: {
        queueName: input.queueName,
        name: input.name,
        payload: toJsonObject(input.payload),
        attempts: DEFAULT_JOB_ATTEMPTS
      }
    },
    select: { id: true }
  });

  await input.queue.add(
    input.name,
    {
      ...input.payload,
      generationJobId: generationJob.id
    },
    {
      jobId: generationJob.id,
      attempts: DEFAULT_JOB_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: DEFAULT_BACKOFF_DELAY_MS
      },
      removeOnComplete: {
        age: 86_400,
        count: 1_000
      },
      removeOnFail: false
    }
  );

  return generationJob;
}

async function resolveProjectUserId(
  prisma: PrismaService,
  projectId: string
): Promise<string | undefined> {
  const project = await prisma.userBookProject.findUnique({
    where: { id: projectId },
    select: { userId: true }
  });

  return project?.userId;
}

async function requireProjectUserId(
  prisma: PrismaService,
  projectId: string,
  providedUserId: string | undefined
): Promise<string> {
  const userId = providedUserId ?? (await resolveProjectUserId(prisma, projectId));

  if (userId === undefined) {
    throw new Error(`Project "${projectId}" does not have a resolvable owner.`);
  }

  return userId;
}

async function ensureProjectWorldBible(
  prisma: PrismaService,
  projectId: string,
  analysisId: string
): Promise<{ readonly id: string }> {
  const project = await prisma.userBookProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      seriesId: true,
      worldBible: { select: { id: true } },
      series: { select: { worldBible: { select: { id: true } } } },
      bookAnalysis: { select: { worldBible: { select: { id: true } } } }
    }
  });

  if (!project) {
    throw new Error(`Project "${projectId}" was not found.`);
  }

  const existing =
    project.series?.worldBible ?? project.worldBible ?? project.bookAnalysis?.worldBible;

  if (existing) {
    return existing;
  }

  return prisma.worldBible.create({
    data: project.seriesId
      ? { seriesId: project.seriesId }
      : { projectId: project.id, bookAnalysisId: analysisId },
    select: { id: true }
  });
}

async function findProjectWorldBible(
  prisma: PrismaService,
  projectId: string
): Promise<{ readonly id: string } | undefined> {
  const project = await prisma.userBookProject.findUnique({
    where: { id: projectId },
    select: {
      worldBible: { select: { id: true } },
      series: { select: { worldBible: { select: { id: true } } } },
      bookAnalysis: { select: { worldBible: { select: { id: true } } } }
    }
  });

  return project?.series?.worldBible ?? project?.worldBible ?? project?.bookAnalysis?.worldBible ?? undefined;
}

async function getBookAnalysisMetadata(
  prisma: PrismaService,
  analysisId: string
): Promise<Prisma.JsonValue | null> {
  const analysis = await prisma.bookAnalysis.findUnique({
    where: { id: analysisId },
    select: { metadata: true }
  });

  return analysis?.metadata ?? null;
}

async function markAnalysisFailed(
  prisma: PrismaService,
  analysisId: string | undefined,
  error: Error
): Promise<void> {
  if (analysisId === undefined) {
    return;
  }

  await prisma.bookAnalysis.update({
    where: { id: analysisId },
    data: {
      status: 'FAILED',
      metadata: mergeMetadata(await getBookAnalysisMetadata(prisma, analysisId), {
        error: error.message
      })
    }
  });
}

function mergeMetadata(
  current: Prisma.JsonValue | null,
  patch: Record<string, unknown>
): Prisma.InputJsonObject {
  return {
    ...toRecord(current),
    ...toJsonObject(patch)
  };
}

function toRecord(value: Prisma.JsonValue | null): Record<string, Prisma.InputJsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Prisma.InputJsonValue>)
    : {};
}

function getPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
