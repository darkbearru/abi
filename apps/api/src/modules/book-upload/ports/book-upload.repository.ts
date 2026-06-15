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

  public abstract createProjectForAnalysis(input: {
    readonly userId: string;
    readonly bookId: string;
    readonly bookAnalysisId: string;
    readonly title: string;
    readonly seriesTitle?: string;
  }): Promise<{ readonly projectId: string }>;
}
