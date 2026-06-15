import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

import { DynamicModule, Inject, Injectable, Module, Optional } from '@nestjs/common';

export type SaveFileContent = Uint8Array | Buffer | string | Readable;

export interface SaveFileInput {
  readonly content: SaveFileContent;
  readonly directory?: string;
  readonly filename?: string;
  readonly originalName?: string;
  readonly mimeType?: string;
}

export interface StoredFile {
  readonly path: string;
  readonly localPath: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
  readonly key: string;
  readonly contentType: string;
}

export interface StorageProvider {
  save(input: SaveFileInput): Promise<StoredFile>;
  read(path: string): Promise<Readable>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface PutObjectRequest {
  readonly key: string;
  readonly body: Uint8Array;
  readonly contentType: string;
}

export type StorageObject = StoredFile;

export interface LocalStorageProviderOptions {
  readonly rootDir?: string;
}

export interface S3StorageProviderOptions {
  readonly bucket: string;
  readonly region?: string;
  readonly endpoint?: string;
}

export type StorageProviderFactoryOptions =
  | ({ readonly type: 'local' } & LocalStorageProviderOptions)
  | ({ readonly type: 's3' } & S3StorageProviderOptions);

export const STORAGE_PROVIDER = 'ABI_STORAGE_PROVIDER';
const DEFAULT_STORAGE_ROOT = './storage';
const DEFAULT_MIME_TYPE = 'application/octet-stream';

export interface StorageModuleOptions {
  readonly provider?: StorageProvider;
  readonly rootDir?: string;
}

export class StorageProviderNotConfiguredError extends Error {
  constructor() {
    super('Storage provider is not configured.');
    this.name = 'StorageProviderNotConfiguredError';
  }
}

export class UnsafeStoragePathError extends Error {
  constructor(path: string) {
    super(`Unsafe storage path: ${path}`);
    this.name = 'UnsafeStoragePathError';
  }
}

export class S3StorageProviderNotImplementedError extends Error {
  constructor() {
    super('S3StorageProvider is a skeleton and is not implemented yet.');
    this.name = 'S3StorageProviderNotImplementedError';
  }
}

export class LocalStorageProvider implements StorageProvider {
  private readonly rootDir: string;

  constructor(options: LocalStorageProviderOptions = {}) {
    this.rootDir = resolve(options.rootDir ?? DEFAULT_STORAGE_ROOT);
  }

  async save(input: SaveFileInput): Promise<StoredFile> {
    const directory = sanitizeDirectory(input.directory ?? '');
    const filename = buildSafeFilename(input);
    const relativePath = directory ? `${directory}/${filename}` : filename;
    const absolutePath = this.resolveStoragePath(relativePath);
    const bytes = await toBuffer(input.content);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);

    return toStoredFile({
      relativePath,
      filename,
      mimeType: input.mimeType ?? DEFAULT_MIME_TYPE,
      size: bytes.byteLength
    });
  }

  async read(path: string): Promise<Readable> {
    const absolutePath = this.resolveStoragePath(path);

    await Promise.resolve();
    return createReadStream(absolutePath);
  }

  async delete(path: string): Promise<void> {
    const absolutePath = this.resolveStoragePath(path);

    await rm(absolutePath, { force: true });
  }

  async exists(path: string): Promise<boolean> {
    const absolutePath = this.resolveStoragePath(path);

    try {
      await stat(absolutePath);
      return true;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return false;
      }

      throw error;
    }
  }

  private resolveStoragePath(path: string): string {
    const normalizedPath = normalizeStoragePath(path);
    const absolutePath = resolve(this.rootDir, normalizedPath);

    if (!isInsideRoot(this.rootDir, absolutePath)) {
      throw new UnsafeStoragePathError(path);
    }

    return absolutePath;
  }
}

export class S3StorageProvider implements StorageProvider {
  constructor(readonly options: S3StorageProviderOptions) {}

  save(): Promise<StoredFile> {
    throw new S3StorageProviderNotImplementedError();
  }

  read(): Promise<Readable> {
    throw new S3StorageProviderNotImplementedError();
  }

  delete(): Promise<void> {
    throw new S3StorageProviderNotImplementedError();
  }

  exists(): Promise<boolean> {
    throw new S3StorageProviderNotImplementedError();
  }
}

export class StorageProviderFactory {
  static create(options: StorageProviderFactoryOptions): StorageProvider {
    if (options.type === 'local') {
      return new LocalStorageProvider(
        options.rootDir === undefined ? {} : { rootDir: options.rootDir }
      );
    }

    return new S3StorageProvider(options);
  }
}

@Injectable()
export class StorageService implements StorageProvider {
  constructor(
    @Optional()
    @Inject(STORAGE_PROVIDER)
    private readonly provider?: StorageProvider
  ) {}

  save(input: SaveFileInput): Promise<StoredFile> {
    return this.getProvider().save(input);
  }

  read(path: string): Promise<Readable> {
    return this.getProvider().read(path);
  }

  delete(path: string): Promise<void> {
    return this.getProvider().delete(path);
  }

  exists(path: string): Promise<boolean> {
    return this.getProvider().exists(path);
  }

  putObject(request: PutObjectRequest): Promise<StorageObject> {
    return this.save({
      content: request.body,
      directory: dirname(request.key),
      filename: basename(request.key),
      mimeType: request.contentType
    });
  }

  private getProvider(): StorageProvider {
    if (!this.provider) {
      throw new StorageProviderNotConfiguredError();
    }

    return this.provider;
  }
}

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: () => new LocalStorageProvider()
    },
    StorageService
  ],
  exports: [STORAGE_PROVIDER, StorageService]
})
export class StorageModule {
  static register(options: StorageModuleOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_PROVIDER,
          useValue:
            options.provider ??
            new LocalStorageProvider(
              options.rootDir === undefined ? {} : { rootDir: options.rootDir }
            )
        },
        StorageService
      ],
      exports: [STORAGE_PROVIDER, StorageService]
    };
  }
}

function toStoredFile(input: {
  readonly relativePath: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
}): StoredFile {
  return {
    path: input.relativePath,
    localPath: input.relativePath,
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.size,
    key: input.relativePath,
    contentType: input.mimeType
  };
}

function normalizeStoragePath(path: string): string {
  if (path.trim() === '' || isAbsolute(path)) {
    throw new UnsafeStoragePathError(path);
  }

  const normalizedPath = normalize(path).replaceAll('\\', '/');

  if (
    normalizedPath === '..' ||
    normalizedPath.startsWith('../') ||
    normalizedPath.includes('/../')
  ) {
    throw new UnsafeStoragePathError(path);
  }

  return normalizedPath.replace(/^\/+/, '');
}

function sanitizeDirectory(directory: string): string {
  if (directory === '.' || directory.trim() === '') {
    return '';
  }

  return normalizeStoragePath(directory);
}

function buildSafeFilename(input: SaveFileInput): string {
  const sourceName = input.filename ?? input.originalName;
  const extension = sanitizeExtension(sourceName ? extname(sourceName) : extensionFromMime(input.mimeType));
  const readablePart = sanitizeFilename(sourceName ? basename(sourceName, extname(sourceName)) : 'file');
  const contentHash = hashContentHint(input.content);

  return `${readablePart}-${contentHash}-${randomUUID()}${extension}`;
}

function sanitizeFilename(filename: string): string {
  const normalized = filename
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/\.+/g, '.')
    .slice(0, 80);

  return normalized && normalized !== '.' && normalized !== '..' ? normalized : 'file';
}

function sanitizeExtension(extension: string): string {
  if (!extension) {
    return '';
  }

  const normalized = extension.toLowerCase().replace(/[^a-z0-9.]/g, '');

  return normalized.startsWith('.') ? normalized.slice(0, 16) : `.${normalized.slice(0, 15)}`;
}

function extensionFromMime(mimeType?: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'text/plain':
      return '.txt';
    case 'application/pdf':
      return '.pdf';
    default:
      return '';
  }
}

function hashContentHint(content: SaveFileContent): string {
  if (content instanceof Readable) {
    return 'stream';
  }

  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

async function toBuffer(content: SaveFileContent): Promise<Buffer> {
  if (content instanceof Readable) {
    const chunks: Buffer[] = [];

    for await (const chunk of content) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer));
    }

    return Buffer.concat(chunks);
  }

  return Buffer.isBuffer(content) ? content : Buffer.from(content);
}

function isInsideRoot(rootDir: string, absolutePath: string): boolean {
  return absolutePath === rootDir || absolutePath.startsWith(`${rootDir}${sep}`);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
