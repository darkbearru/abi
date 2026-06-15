export interface CharacterExtractionConfig {
  readonly providerId: string;
  readonly promptVersion: string;
}

export const CHARACTER_EXTRACTION_CONFIG = 'ABI_CHARACTER_EXTRACTION_CONFIG';

export function getCharacterExtractionConfig(): CharacterExtractionConfig {
  return {
    providerId: process.env.CHARACTER_EXTRACTION_AI_PROVIDER ?? 'openai',
    promptVersion: process.env.CHARACTER_EXTRACTION_PROMPT_VERSION ?? '1.0.0'
  };
}
