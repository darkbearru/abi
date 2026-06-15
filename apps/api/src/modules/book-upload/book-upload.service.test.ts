import { describe, expect, it, vi } from 'vitest';

import { BookHashService } from './book-hash.service.js';
import type { BookTextExtractorService } from './book-text-extractor.service.js';
import { BookUploadService } from './book-upload.service.js';
import type { LocalBookFileStorageService } from './local-book-file-storage.service.js';
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
      createProjectForAnalysis: vi.fn().mockResolvedValue({
        projectId: 'project-1'
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
      storage as unknown as LocalBookFileStorageService,
      repository,
      queue
    );

    await expect(service.upload(file, {}, 'user-1')).resolves.toMatchObject({
      bookId: 'existing-book-id',
      projectId: 'project-1',
      bookAnalysisId: 'existing-analysis-id',
      existingAnalysisAvailable: true
    });
    expect(repository.createProjectForAnalysis).toHaveBeenCalledWith({
      userId: 'user-1',
      bookId: 'existing-book-id',
      bookAnalysisId: 'existing-analysis-id',
      title: 'book'
    });
    expect(repository.createBookWithPendingAnalysis).not.toHaveBeenCalled();
    expect(queue.enqueueBookAnalysis).not.toHaveBeenCalled();
    expect(storage.saveOriginal).not.toHaveBeenCalled();
  });
});
