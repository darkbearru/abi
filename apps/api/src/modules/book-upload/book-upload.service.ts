import { basename, extname } from 'node:path';

import { Injectable } from '@nestjs/common';

import { BookHashService } from './book-hash.service.js';
import { BookTextExtractorService } from './book-text-extractor.service.js';
import type { UploadBookDto } from './dto/upload-book.dto.js';
import type { UploadBookResponseDto } from './dto/upload-book.response.dto.js';
import { LocalBookFileStorageService } from './local-book-file-storage.service.js';
import { AnalysisJobQueue } from './ports/analysis-job.queue.js';
import { BookUploadRepository } from './ports/book-upload.repository.js';
import { TextNormalizationService } from './text-normalization.service.js';
import type { UploadedBookFile } from './book-upload.types.js';

@Injectable()
export class BookUploadService {
  public constructor(
    private readonly hashService: BookHashService,
    private readonly textExtractor: BookTextExtractorService,
    private readonly textNormalization: TextNormalizationService,
    private readonly storage: LocalBookFileStorageService,
    private readonly repository: BookUploadRepository,
    private readonly analysisJobQueue: AnalysisJobQueue
  ) {}

  public async upload(
    file: UploadedBookFile,
    dto: UploadBookDto
  ): Promise<UploadBookResponseDto> {
    const fileHash = this.hashService.sha256(file.buffer);
    const storedFile = await this.storage.saveOriginal(file, fileHash);
    const extractedText = await this.textExtractor.extractText(file);
    const normalizedText = this.textNormalization.normalize(extractedText);
    const contentHash = this.hashService.sha256(normalizedText);

    const existingAnalysis = await this.repository.findAnalysisByContentHash(contentHash);

    if (existingAnalysis) {
      return {
        bookId: existingAnalysis.bookId,
        bookAnalysisId: existingAnalysis.bookAnalysisId,
        existingAnalysisAvailable: true,
        fileHash,
        contentHash
      };
    }

    const created = await this.repository.createBookWithPendingAnalysis({
      title: dto.title ?? this.getTitleFromFilename(file.originalname),
      ...(dto.author === undefined ? {} : { author: dto.author }),
      ...(dto.language === undefined ? {} : { language: dto.language }),
      fileHash,
      contentHash,
      file: {
        localPath: storedFile.localPath,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        fileHash
      }
    });

    await this.analysisJobQueue.enqueueBookAnalysis(created);

    return {
      bookId: created.bookId,
      bookAnalysisId: created.bookAnalysisId,
      existingAnalysisAvailable: false,
      fileHash,
      contentHash
    };
  }

  private getTitleFromFilename(filename: string): string {
    const extension = extname(filename);

    return basename(filename, extension) || filename;
  }
}
