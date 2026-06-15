import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  LocalStorageProvider,
  S3StorageProvider,
  S3StorageProviderNotImplementedError,
  StorageProviderFactory,
  StorageProviderNotConfiguredError,
  StorageService,
  UnsafeStoragePathError,
  type StorageProvider
} from './index.js';

describe('LocalStorageProvider', () => {
  let rootDir: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'abi-storage-'));
    provider = new LocalStorageProvider({ rootDir });
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('saves files under the configured storage root and creates directories', async () => {
    const stored = await provider.save({
      directory: 'characters/john',
      originalName: 'Front View.png',
      content: Buffer.from('image-bytes'),
      mimeType: 'image/png'
    });

    expect(stored.path).toMatch(/^characters\/john\/Front-View-[a-f0-9]{12}-.+\.png$/);
    expect(stored.localPath).toBe(stored.path);
    expect(stored.mimeType).toBe('image/png');
    expect(stored.size).toBe(Buffer.byteLength('image-bytes'));
    await expect(readFile(join(rootDir, stored.path), 'utf8')).resolves.toBe('image-bytes');
  });

  it('reads stored files as streams', async () => {
    const stored = await provider.save({
      directory: 'books',
      filename: 'chapter.txt',
      content: 'Chapter text',
      mimeType: 'text/plain'
    });

    await expect(readStream(await provider.read(stored.path))).resolves.toBe('Chapter text');
  });

  it('deletes stored files and reports existence', async () => {
    const stored = await provider.save({
      filename: 'asset.txt',
      content: 'temporary'
    });

    await expect(provider.exists(stored.path)).resolves.toBe(true);
    await provider.delete(stored.path);
    await expect(provider.exists(stored.path)).resolves.toBe(false);
  });

  it('rejects path traversal for directory, read, delete, and exists', async () => {
    await expect(
      provider.save({
        directory: '../outside',
        filename: 'evil.txt',
        content: 'nope'
      })
    ).rejects.toBeInstanceOf(UnsafeStoragePathError);

    await expect(provider.read('../outside.txt')).rejects.toBeInstanceOf(UnsafeStoragePathError);
    await expect(provider.delete('../outside.txt')).rejects.toBeInstanceOf(UnsafeStoragePathError);
    await expect(provider.exists('../outside.txt')).rejects.toBeInstanceOf(UnsafeStoragePathError);
  });

  it('generates safe filenames from unsafe original names', async () => {
    const stored = await provider.save({
      directory: 'safe',
      originalName: '../../My unsafe file name ?.txt',
      content: 'safe'
    });

    expect(stored.filename).toMatch(/^My-unsafe-file-name-[a-f0-9]{12}-.+\.txt$/);
    expect(stored.path).toMatch(/^safe\/My-unsafe-file-name-[a-f0-9]{12}-.+\.txt$/);
    await expect(readFile(join(rootDir, stored.path), 'utf8')).resolves.toBe('safe');
  });

  it('supports legacy putObject through StorageService', async () => {
    const service = new StorageService(provider);

    const stored = await service.putObject({
      key: 'legacy/object.bin',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'application/octet-stream'
    });

    expect(stored.key).toMatch(/^legacy\/object-[a-f0-9]{12}-.+\.bin$/);
    await expect(provider.exists(stored.key)).resolves.toBe(true);
  });
});

describe('StorageService', () => {
  it('delegates to the configured provider', async () => {
    const provider: StorageProvider = {
      save: (input) =>
        Promise.resolve({
          path: 'saved.txt',
          localPath: 'saved.txt',
          filename: input.filename ?? 'saved.txt',
          mimeType: input.mimeType ?? 'application/octet-stream',
          size: 1,
          key: 'saved.txt',
          contentType: input.mimeType ?? 'application/octet-stream'
        }),
      read: () => Promise.resolve(Readable.from('saved')),
      delete: () => Promise.resolve(),
      exists: () => Promise.resolve(true)
    };
    const service = new StorageService(provider);

    await expect(service.save({ filename: 'saved.txt', content: 'x' })).resolves.toMatchObject({
      path: 'saved.txt'
    });
    await expect(service.exists('saved.txt')).resolves.toBe(true);
  });

  it('throws a typed error without a configured provider', () => {
    const service = new StorageService();

    expect(() => service.save({ content: new Uint8Array() })).toThrow(
      StorageProviderNotConfiguredError
    );
  });
});

describe('StorageProviderFactory', () => {
  it('creates local providers', () => {
    expect(StorageProviderFactory.create({ type: 'local', rootDir: './storage' })).toBeInstanceOf(
      LocalStorageProvider
    );
  });

  it('creates S3 skeleton providers', () => {
    const provider = StorageProviderFactory.create({ type: 's3', bucket: 'abi-assets' });

    expect(provider).toBeInstanceOf(S3StorageProvider);
    expect(() => provider.exists('file.png')).toThrow(
      S3StorageProviderNotImplementedError
    );
  });
});

async function readStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer));
  }

  return Buffer.concat(chunks).toString('utf8');
}
