export interface LocationExtractionConfig {
  readonly providerId: string;
  readonly promptVersion: string;
}

export const LOCATION_EXTRACTION_CONFIG = 'ABI_LOCATION_EXTRACTION_CONFIG';

export function getLocationExtractionConfig(): LocationExtractionConfig {
  return {
    providerId: process.env.LOCATION_EXTRACTION_AI_PROVIDER ?? 'openai',
    promptVersion: process.env.LOCATION_EXTRACTION_PROMPT_VERSION ?? '1.0.0'
  };
}
