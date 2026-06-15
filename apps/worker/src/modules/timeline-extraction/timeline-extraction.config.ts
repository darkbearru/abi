export interface TimelineExtractionConfig {
  readonly providerId: string;
  readonly promptVersion: string;
}

export const TIMELINE_EXTRACTION_CONFIG = 'ABI_TIMELINE_EXTRACTION_CONFIG';

export function getTimelineExtractionConfig(): TimelineExtractionConfig {
  return {
    providerId: process.env.TIMELINE_EXTRACTION_AI_PROVIDER ?? 'openai',
    promptVersion: process.env.TIMELINE_EXTRACTION_PROMPT_VERSION ?? '1.0.0'
  };
}
