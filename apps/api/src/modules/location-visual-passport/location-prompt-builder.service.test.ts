import { describe, expect, it } from 'vitest';

import { LocationVisualPassportAssetTypeDto } from './dto/location-visual-passport.dto.js';
import { LocationPromptBuilderService } from './location-prompt-builder.service.js';

describe('LocationPromptBuilderService', () => {
  it('builds a location passport prompt with parent location context', () => {
    const service = new LocationPromptBuilderService();
    const result = service.buildLocationVisualPassportPrompt({
      locationName: 'Fountain of Glass Birds',
      parentLocations: [
        {
          id: 'city-1',
          name: 'Old City',
          description: 'a dense river city with narrow stone streets',
          atmosphere: { mood: 'misty' },
          palette: { dominant: ['blue-gray', 'warm brass'] },
          era: 'late industrial',
          architectureRules: { materials: ['stone', 'iron balconies'] }
        },
        {
          id: 'park-1',
          name: 'Moon Park',
          description: 'an overgrown public park inside the old walls',
          atmosphere: { mood: 'quiet and watchful' },
          palette: { dominant: ['deep green', 'silver'] },
          era: 'late industrial',
          architectureRules: { landmarks: ['wrought iron gates'] }
        }
      ],
      locationVersion: {
        version: 1,
        description: 'a cracked marble fountain with bird-shaped glass spouts',
        atmosphere: { mood: 'enchanted but abandoned' },
        palette: { accent: 'pale cyan glass' },
        era: 'late industrial',
        socialContext: { usage: 'forgotten meeting place' },
        lightingRules: { time: 'blue hour', source: 'gas lamps' },
        architectureRules: { materials: ['marble', 'glass'] },
        recurringObjects: { objects: ['fallen feathers', 'copper coins'] }
      },
      visualStyle: {
        name: 'Noir Comic',
        prompt: 'high-contrast panels with controlled ink texture',
        negativePrompt: 'soft watercolor',
        primaryColor: '#101010',
        secondaryColor: '#d9d2bd',
        accentColor: '#67d4e8',
        contrastLevel: 90,
        saturationLevel: 35,
        grainLevel: 60,
        lineThickness: 75
      },
      assetType: LocationVisualPassportAssetTypeDto.MAIN_ANGLE,
      seed: 987
    });

    expect(result.prompt).toContain(
      'Parent location chain: Old City > Moon Park > Fountain of Glass Birds'
    );
    expect(result.prompt).toContain('Parent 1: Old City');
    expect(result.prompt).toContain('Parent 2: Moon Park');
    expect(result.prompt).toContain('primary cinematic angle');
    expect(result.prompt).toContain('Lighting rules: {"time":"blue hour","source":"gas lamps"}');
    expect(result.prompt).toContain('Noir Comic');
    expect(result.prompt).toContain('Contrast level: 90/100');
    expect(result.negativePrompt).toContain('soft watercolor');
    expect(result.negativePrompt).toContain('inconsistent geography');
  });
});
