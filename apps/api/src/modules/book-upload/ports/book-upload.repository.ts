import type {
  BookAnalysisReference,
  CreateBookWithAnalysisInput
} from '../book-upload.types.js';

export abstract class BookUploadRepository {
  public abstract findAnalysisByContentHash(
    contentHash: string
  ): Promise<BookAnalysisReference | null>;

  public abstract createBookWithPendingAnalysis(
    input: CreateBookWithAnalysisInput
  ): Promise<BookAnalysisReference>;
}
