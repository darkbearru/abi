import { describe, expect, it } from 'vitest';

import { CharacterVisualPassportAssetTypeDto } from './dto/character-visual-passport.dto.js';
import { PromptBuilderService } from './prompt-builder.service.js';

describe('PromptBuilderService', () => {
  it('builds a character passport prompt from character version and visual style', () => {
    const service = new PromptBuilderService();
    const result = service.buildCharacterVisualPassportPrompt({
      characterName: 'Mara',
      characterVersion: {
        version: 2,
        age: 'young adult',
        timelineRange: { phase: 'exile' },
        appearance: { hair: 'black bob', eyes: 'gray' },
        personality: { traits: ['guarded', 'brave'] },
        speechManner: 'short deliberate phrases',
        clothing: { coat: 'weathered blue coat' },
        visualPrompt: 'scar over left eyebrow',
        negativePrompt: 'smiling childlike face'
      },
      visualStyle: {
        name: 'Graphic Novel',
        prompt: 'bold ink silhouettes',
        negativePrompt: 'soft watercolor',
        primaryColor: '#111111',
        secondaryColor: '#eeeeee',
        accentColor: '#cc3333',
        contrastLevel: 80,
        saturationLevel: 45,
        grainLevel: 20,
        lineThickness: 70
      },
      assetType: CharacterVisualPassportAssetTypeDto.FRONT_VIEW,
      seed: 123
    });

    expect(result.prompt).toContain('Character: Mara');
    expect(result.prompt).toContain('full body front view');
    expect(result.prompt).toContain('Graphic Novel');
    expect(result.prompt).toContain('Contrast level: 80/100');
    expect(result.negativePrompt).toContain('soft watercolor');
    expect(result.negativePrompt).toContain('smiling childlike face');
  });
});
