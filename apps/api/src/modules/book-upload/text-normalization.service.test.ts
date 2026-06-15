import { describe, expect, it } from 'vitest';

import { TextNormalizationService } from './text-normalization.service.js';

describe('TextNormalizationService', () => {
  it('normalizes whitespace and line endings', () => {
    const service = new TextNormalizationService();

    expect(service.normalize('  Hello\t world\r\n\r\n\r\nNext\u00a0line  ')).toBe(
      'Hello world\n\nNext line'
    );
  });
});
