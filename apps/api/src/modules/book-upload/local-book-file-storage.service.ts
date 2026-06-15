import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { Injectable } from '@nestjs/common';

import { getBookUploadConfig } from './book-upload.config.js';
import type { StoredBookFile, UploadedBookFile } from './book-upload.types.js';

@Injectable()
export class LocalBookFileStorageService {
  public async saveOriginal(file: UploadedBookFile, fileHash: string): Promise<StoredBookFile> {
    const { storageRoot } = getBookUploadConfig();
    const extension = extname(file.originalname).toLowerCase();
    const relativePath = join('books', `${fileHash}${extension}`);
    const absolutePath = join(storageRoot, relativePath);

    await mkdir(join(storageRoot, 'books'), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      localPath: absolutePath
    };
  }
}
