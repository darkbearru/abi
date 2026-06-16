import { describe, expect, it } from 'vitest';

import { CharacterExtractionResponseSchema } from './character-extraction.schema.js';

describe('CharacterExtractionResponseSchema', () => {
  it('normalizes provider JSON without failing the whole chunk on minor shape drift', () => {
    const parsed = CharacterExtractionResponseSchema.parse([
      {
        type: 'CHARACTER_MENTION',
        entityName: 42,
        value: {
          summary: true,
          candidateNames: 'John'
        },
        confidence: 'high',
        quote: null
      },
      {
        type: 'UNKNOWN_FACT',
        entityName: 'discarded',
        value: {},
        confidence: 0.9
      }
    ]);

    expect(parsed.facts).toEqual([
      {
        type: 'CHARACTER_MENTION',
        entityName: '42',
        value: {
          summary: 'true',
          candidateNames: ['John']
        },
        confidence: 0.85
      }
    ]);
  });
});
