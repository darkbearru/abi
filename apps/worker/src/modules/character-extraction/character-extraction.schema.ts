import { z } from 'zod';

export const ExtractedCharacterFactTypeSchema = z.enum([
  'CHARACTER_MENTION',
  'CHARACTER_ALIAS',
  'CHARACTER_APPEARANCE',
  'CHARACTER_AGE',
  'CHARACTER_PERSONALITY',
  'CHARACTER_SPEECH_MANNER',
  'CHARACTER_RELATIONSHIP',
  'CHARACTER_PLOT_CHANGE',
  'CHARACTER_CANDIDATE'
]);

export const ExtractedCharacterFactValueSchema = z
  .object({
    summary: z.string().trim().min(1),
    candidateNames: z.array(z.string().trim().min(1)).optional(),
    targetEntityName: z.string().trim().min(1).optional(),
    relationshipType: z.string().trim().min(1).optional(),
    change: z.string().trim().min(1).optional()
  })
  .strict();

export const ExtractedCharacterFactSchema = z
  .object({
    type: ExtractedCharacterFactTypeSchema,
    entityName: z.string().trim().min(1),
    value: ExtractedCharacterFactValueSchema,
    confidence: z.number().min(0).max(1),
    quote: z.string().trim().min(1).optional(),
    timelineHint: z.string().trim().min(1).optional()
  })
  .strict();

export const CharacterExtractionResponseSchema = z
  .object({
    facts: z.array(ExtractedCharacterFactSchema).optional()
  })
  .strict();

export type ExtractedCharacterFact = z.infer<typeof ExtractedCharacterFactSchema>;
export type CharacterExtractionResponse = z.infer<typeof CharacterExtractionResponseSchema>;
