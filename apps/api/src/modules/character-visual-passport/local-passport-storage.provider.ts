import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { PutObjectRequest, StorageObject, StorageProvider } from '@abi/storage';

export class LocalPassportStorageProvider implements StorageProvider {
  constructor(private readonly storageRoot = process.env.STORAGE_ROOT ?? './storage') {}

  async putObject(request: PutObjectRequest): Promise<StorageObject> {
    const normalizedKey = request.key.replace(/^\/+/, '');
    const absolutePath = join(this.storageRoot, normalizedKey);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, request.body);

    return {
      key: normalizedKey,
      contentType: request.contentType
    };
  }
}
