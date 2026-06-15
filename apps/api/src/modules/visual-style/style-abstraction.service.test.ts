import { describe, expect, it } from 'vitest';

import { StyleAbstractionService } from './style-abstraction.service.js';

describe('StyleAbstractionService', () => {
  it('abstracts Arcane-style requests into broad visual language', () => {
    const service = new StyleAbstractionService();
    const result = service.abstract('в стиле Аркейн');

    expect(result.prompt.toLowerCase()).not.toContain('arcane');
    expect(result.prompt.toLowerCase()).not.toContain('аркейн');
    expect(result.visualLanguage).toContain('Painterly cinematic animation');
    expect(result.negativePrompt).toContain('direct franchise imitation');
    expect(result.avoidedReferences).toContain('аркейн');
  });

  it('abstracts Sin City-style requests into noir comic language', () => {
    const service = new StyleAbstractionService();
    const result = service.abstract('в стиле Город грехов');

    expect(result.prompt.toLowerCase()).not.toContain('sin city');
    expect(result.prompt.toLowerCase()).not.toContain('город грехов');
    expect(result.visualLanguage).toContain('High-contrast noir comic');
    expect(result.contrastLevel).toBeGreaterThan(80);
  });
});
