import { mkdtemp, rm } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalBookFileStorageService } from './local-book-file-storage.service.js';

describe('LocalBookFileStorageService', () => {
  let storageRoot: string;
  let previousStorageRoot: string | undefined;

  beforeEach(async () => {
    previousStorageRoot = process.env.STORAGE_ROOT;
    storageRoot = await mkdtemp(join(tmpdir(), 'abi-book-upload-'));
    process.env.STORAGE_ROOT = storageRoot;
  });

  afterEach(async () => {
    process.env.STORAGE_ROOT = previousStorageRoot;
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('stores original files through the shared storage provider using relative keys', async () => {
    const service = new LocalBookFileStorageService();
    const stored = await service.saveOriginal(
      {
        originalname: '../unsafe.txt',
        mimetype: 'text/plain',
        size: 5,
        buffer: Buffer.from('hello')
      },
      'abc123'
    );

    expect(stored.localPath).toMatch(/^books\/abc123-[a-f0-9]{12}-.+\.txt$/);
    expect(isAbsolute(stored.localPath)).toBe(false);
  });
});
