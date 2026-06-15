export interface EnqueueBookAnalysisInput {
  readonly bookId: string;
  readonly bookAnalysisId: string;
  readonly projectId: string;
  readonly userId: string;
}

export abstract class AnalysisJobQueue {
  public abstract enqueueBookAnalysis(input: EnqueueBookAnalysisInput): Promise<void>;
}
