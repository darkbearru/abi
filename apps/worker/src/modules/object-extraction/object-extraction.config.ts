export interface ObjectExtractionConfig {
  readonly providerId: string;
  readonly promptVersion: string;
}

export const OBJECT_EXTRACTION_CONFIG = 'ABI_OBJECT_EXTRACTION_CONFIG';

export function getObjectExtractionConfig(): ObjectExtractionConfig {
  return {
    providerId: process.env.OBJECT_EXTRACTION_AI_PROVIDER ?? 'openai',
    promptVersion: process.env.OBJECT_EXTRACTION_PROMPT_VERSION ?? '1.0.0'
  };
}
