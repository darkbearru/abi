import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { TimelineEventResponseDto } from './dto/timeline-event.response.dto.js';

const TIMELINE_EVENT_INCLUDE = {
  characterVersions: {
    include: {
      characterVersion: {
        include: {
          character: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  }
} satisfies Prisma.TimelineEventInclude;

@Injectable()
export class TimelineQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectTimeline(projectId: string): Promise<readonly TimelineEventResponseDto[]> {
    const project = await this.prisma.userBookProject.findUnique({
      where: { id: projectId },
      select: {
        worldBible: { select: { id: true } },
        series: { select: { worldBible: { select: { id: true } } } },
        bookAnalysis: { select: { worldBible: { select: { id: true } } } }
      }
    });

    if (!project) {
      throw new NotFoundException('Project was not found.');
    }

    const worldBibleId =
      project.series?.worldBible?.id ?? project.worldBible?.id ?? project.bookAnalysis?.worldBible?.id;

    if (!worldBibleId) {
      return [];
    }

    const events = await this.prisma.timelineEvent.findMany({
      where: { worldBibleId },
      include: TIMELINE_EVENT_INCLUDE,
      orderBy: [{ relativeOrder: 'asc' }, { chapterIndex: 'asc' }, { orderIndex: 'asc' }]
    });

    return events.map(toResponseDto);
  }
}

export type TimelineEventWithDetails = Prisma.TimelineEventGetPayload<{
  include: typeof TIMELINE_EVENT_INCLUDE;
}>;

function toResponseDto(event: TimelineEventWithDetails): TimelineEventResponseDto {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    chapterIndex: event.chapterIndex,
    absoluteDate: event.absoluteDate,
    relativeOrder: event.relativeOrder,
    involvedCharacterIds: event.involvedCharacterIds,
    involvedLocationIds: event.involvedLocationIds,
    sourceChunkIds: event.sourceChunkIds,
    confidence: event.confidence,
    relativeMarkers:
      event.relativeMarkers && typeof event.relativeMarkers === 'object'
        ? (event.relativeMarkers as Record<string, unknown>)
        : null,
    characterVersions: event.characterVersions.map((link) => ({
      characterVersionId: link.characterVersionId,
      characterId: link.characterVersion.characterId,
      characterName: link.characterVersion.character.canonicalName,
      version: link.characterVersion.version
    }))
  };
}
