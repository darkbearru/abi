import { extname } from 'node:path';

import { Injectable } from '@nestjs/common';
import { LocalStorageProvider } from '@abi/storage';

import { getBookUploadConfig } from './book-upload.config.js';
import type { StoredBookFile, UploadedBookFile } from './book-upload.types.js';

@Injectable()
export class LocalBookFileStorageService {
  private readonly storage = new LocalStorageProvider({
    rootDir: getBookUploadConfig().storageRoot
  });

  public async saveOriginal(file: UploadedBookFile, fileHash: string): Promise<StoredBookFile> {
    const extension = extname(file.originalname).toLowerCase();
    const stored = await this.storage.save({
      content: file.buffer,
      directory: 'books',
      filename: `${fileHash}${extension}`,
      mimeType: file.mimetype
    });

    return {
      localPath: stored.localPath
    };
  }
}
