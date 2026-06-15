import { Injectable } from '@nestjs/common';

import type { AbstractedVisualStyleDto } from './dto/visual-style.dto.js';

interface StyleAbstractionPreset {
  readonly triggers: readonly string[];
  readonly visualLanguage: string;
  readonly prompt: string;
  readonly negativePrompt: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly accentColor: string;
  readonly contrastLevel: number;
  readonly saturationLevel: number;
  readonly grainLevel: number;
  readonly lineThickness: number;
}

const SAFETY_NOTE =
  'The result describes a broad visual language and avoids naming or copying a protected living artist, studio, franchise, or exact signature style.';

const PRESETS: readonly StyleAbstractionPreset[] = [
  {
    triggers: ['аркейн', 'arcane'],
    visualLanguage:
      'Painterly cinematic animation with angular silhouettes, expressive faces, textured brushwork, dramatic colored rim light, and industrial-fantasy production design.',
    prompt:
      'painterly cinematic animation, angular character silhouettes, expressive face acting, textured brush strokes, dramatic colored rim light, layered industrial fantasy environments, rich teal and amber color keys',
    negativePrompt:
      'direct franchise imitation, copied character design, exact studio look, logo, trademarked costume, flat plastic render',
    primaryColor: '#26344a',
    secondaryColor: '#b66d4f',
    accentColor: '#4fb7b3',
    contrastLevel: 72,
    saturationLevel: 64,
    grainLevel: 32,
    lineThickness: 36
  },
  {
    triggers: ['город грехов', 'sin city'],
    visualLanguage:
      'High-contrast noir comic language with mostly monochrome values, hard-edged shadows, sparse saturated accent color, rain-slick surfaces, and graphic negative space.',
    prompt:
      'high contrast noir comic illustration, stark monochrome lighting, hard edged shadows, sparse saturated accent color, rain slick streets, graphic negative space, dramatic silhouettes',
    negativePrompt:
      'direct franchise imitation, copied panel compositions, exact character design, logo, soft pastel daylight, low contrast color wash',
    primaryColor: '#0f0f10',
    secondaryColor: '#f1eee7',
    accentColor: '#c0182f',
    contrastLevel: 94,
    saturationLevel: 20,
    grainLevel: 50,
    lineThickness: 84
  }
];

@Injectable()
export class StyleAbstractionService {
  abstract(input: string): AbstractedVisualStyleDto {
    const sourceRequest = input.trim();
    const preset = PRESETS.find((candidate) =>
      candidate.triggers.some((trigger) => normalize(sourceRequest).includes(trigger))
    );

    if (preset) {
      return {
        sourceRequest,
        visualLanguage: preset.visualLanguage,
        prompt: preset.prompt,
        negativePrompt: preset.negativePrompt,
        avoidedReferences: preset.triggers,
        safetyNote: SAFETY_NOTE,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        accentColor: preset.accentColor,
        contrastLevel: preset.contrastLevel,
        saturationLevel: preset.saturationLevel,
        grainLevel: preset.grainLevel,
        lineThickness: preset.lineThickness
      };
    }

    return createGenericAbstraction(sourceRequest);
  }
}

function createGenericAbstraction(sourceRequest: string): AbstractedVisualStyleDto {
  const cleaned = removeStylePreamble(sourceRequest);
  const visualLanguage = [
    'Original illustration direction inspired by the requested mood rather than a named protected style.',
    'Use broad, reusable descriptors: composition, palette, lighting, material texture, line quality, and rendering density.'
  ].join(' ');

  return {
    sourceRequest,
    visualLanguage,
    prompt: [
      cleaned,
      'original visual language, coherent art direction, clear silhouettes, controlled palette, consistent lighting, production-ready illustration'
    ]
      .filter(Boolean)
      .join(', '),
    negativePrompt:
      'direct imitation of a named artist or franchise, copied characters, copied composition, logo, watermark, trademarked costume',
    avoidedReferences: extractPotentialReferences(sourceRequest),
    safetyNote: SAFETY_NOTE,
    primaryColor: '#334155',
    secondaryColor: '#e2dccf',
    accentColor: '#d97757',
    contrastLevel: 58,
    saturationLevel: 46,
    grainLevel: 18,
    lineThickness: 24
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase().normalize('NFKC');
}

function removeStylePreamble(value: string): string {
  return value
    .replace(/^\s*(в\s+стиле|style\s+of|in\s+the\s+style\s+of)\s+/i, '')
    .trim();
}

function extractPotentialReferences(value: string): readonly string[] {
  const cleaned = removeStylePreamble(value);

  return cleaned ? [cleaned] : [];
}
