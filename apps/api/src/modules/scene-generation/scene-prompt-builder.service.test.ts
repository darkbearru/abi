import { describe, expect, it } from 'vitest';

import { ScenePromptBuilderService } from './scene-prompt-builder.service.js';

describe('ScenePromptBuilderService', () => {
  it('assembles image prompt from resolved entities, graph context and approved references', () => {
    const service = new ScenePromptBuilderService();
    const result = service.buildScenePrompt({
      userText: 'John talks to Michael near the fountain.',
      timelineHint: 'after the trial',
      aspectRatio: '16:9',
      characters: [
        {
          id: 'character-1',
          name: 'John',
          aliases: ['Johnny'],
          version: {
            id: 'character-version-1',
            characterId: 'character-1',
            version: 2,
            age: 'middle-aged',
            timelineRange: { phase: 'after trial' },
            appearance: { hair: 'gray at temples' },
            personality: { traits: ['guarded'] },
            speechManner: 'measured',
            clothing: { coat: 'dark wool coat' },
            visualPrompt: 'tired eyes',
            negativePrompt: null,
            confidenceScore: 0.91,
            sourceFactIds: [],
            createdAt: new Date('2026-01-01T00:00:00.000Z')
          }
        }
      ],
      locations: [
        {
          id: 'location-1',
          name: 'Fountain',
          aliases: [],
          version: {
            id: 'location-version-1',
            locationId: 'location-1',
            version: 1,
            description: 'a marble fountain in a city park',
            atmosphere: { mood: 'quiet' },
            palette: { accent: 'cold blue' },
            era: 'late industrial',
            socialContext: null,
            lightingRules: { time: 'dusk' },
            architectureRules: null,
            recurringObjects: { objects: ['coins'] },
            referenceAssetIds: [],
            confidenceScore: 0.88,
            sourceFactIds: [],
            createdAt: new Date('2026-01-01T00:00:00.000Z')
          }
        }
      ],
      objects: [],
      visualStyle: {
        name: 'Cinematic Realism',
        prompt: 'grounded cinematic lighting',
        negativePrompt: 'cartoonish',
        primaryColor: '#20242a',
        secondaryColor: '#d8d0c0',
        accentColor: '#4ca3ff',
        contrastLevel: 70,
        saturationLevel: 45,
        grainLevel: 20,
        lineThickness: 10
      },
      graphContext: {
        nodes: [
          {
            id: 'project-1:Character:character-1',
            labels: ['Character'],
            properties: { canonicalName: 'John' }
          }
        ],
        relationships: [
          {
            id: 'relationship-1',
            type: 'KNOWS',
            source: 'character-1',
            target: 'character-2',
            properties: {}
          }
        ]
      },
      referenceAssets: [
        {
          id: 'asset-1',
          entityType: 'CHARACTER_VERSION',
          entityId: 'character-version-1',
          localPath: 'character-passports/character-version-1/front.png',
          mimeType: 'image/png',
          prompt: 'John reference'
        }
      ]
    });

    expect(result.prompt).toContain('John talks to Michael near the fountain.');
    expect(result.prompt).toContain('Aspect ratio: 16:9');
    expect(result.prompt).toContain('Resolved characters:');
    expect(result.prompt).toContain('appearance={"hair":"gray at temples"}');
    expect(result.prompt).toContain('Knowledge graph context:');
    expect(result.prompt).toContain('relationship KNOWS');
    expect(result.prompt).toContain('Approved reference assets:');
    expect(result.prompt).toContain('character-passports/character-version-1/front.png');
    expect(result.negativePrompt).toContain('cartoonish');
  });
});
