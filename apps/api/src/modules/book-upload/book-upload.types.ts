export interface UploadedBookFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
}

export interface StoredBookFile {
  readonly localPath: string;
}

export interface CreateBookWithAnalysisInput {
  readonly userId: string;
  readonly title: string;
  readonly author?: string;
  readonly language?: string;
  readonly seriesTitle?: string;
  readonly fileHash: string;
  readonly contentHash: string;
  readonly file: {
    readonly localPath: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly fileHash: string;
  };
}

export interface BookAnalysisReference {
  readonly bookId: string;
  readonly bookAnalysisId: string;
  readonly projectId?: string;
  readonly userId?: string;
}
