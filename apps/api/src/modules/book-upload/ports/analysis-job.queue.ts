export interface EnqueueBookAnalysisInput {
  readonly bookId: string;
  readonly bookAnalysisId: string;
}

export abstract class AnalysisJobQueue {
  public abstract enqueueBookAnalysis(input: EnqueueBookAnalysisInput): Promise<void>;
}
