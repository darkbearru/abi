import { describe, expect, it, vi } from 'vitest';

import { BookHashService } from './book-hash.service.js';
import type { BookTextExtractorService } from './book-text-extractor.service.js';
import { BookUploadService } from './book-upload.service.js';
import { TextNormalizationService } from './text-normalization.service.js';
import type { UploadedBookFile } from './book-upload.types.js';

describe('BookUploadService', () => {
  it('returns existingAnalysisAvailable when content hash already exists', async () => {
    const file: UploadedBookFile = {
      originalname: 'book.txt',
      mimetype: 'text/plain',
      size: 11,
      buffer: Buffer.from('hello world')
    };
    const storage = {
      saveOriginal: vi.fn().mockResolvedValue({ localPath: '/tmp/book.txt' })
    };
    const textExtractor = {
      extractText: vi.fn().mockResolvedValue('hello   world')
    };
    const repository = {
      findAnalysisByContentHash: vi.fn().mockResolvedValue({
        bookId: 'existing-book-id',
        bookAnalysisId: 'existing-analysis-id'
      }),
      createBookWithPendingAnalysis: vi.fn()
    };
    const queue = {
      enqueueBookAnalysis: vi.fn()
    };
    const service = new BookUploadService(
      new BookHashService(),
      textExtractor as unknown as BookTextExtractorService,
      new TextNormalizationService(),
      storage,
      repository,
      queue
    );

    await expect(service.upload(file, {})).resolves.toMatchObject({
      bookId: 'existing-book-id',
      bookAnalysisId: 'existing-analysis-id',
      existingAnalysisAvailable: true
    });
    expect(repository.createBookWithPendingAnalysis).not.toHaveBeenCalled();
    expect(queue.enqueueBookAnalysis).not.toHaveBeenCalled();
  });
});
