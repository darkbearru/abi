import { z } from 'zod';

export const ExtractedLocationFactTypeSchema = z.enum([
  'LOCATION_MENTION',
  'LOCATION_ALIAS',
  'LOCATION_HIERARCHY',
  'LOCATION_ATMOSPHERE',
  'LOCATION_ARCHITECTURE',
  'LOCATION_ERA',
  'LOCATION_SOCIAL_CONTEXT',
  'LOCATION_LIGHTING',
  'LOCATION_COLOR',
  'LOCATION_RECURRING_OBJECT',
  'LOCATION_CHANGE',
  'LOCATION_CANDIDATE'
]);

export const ExtractedLocationFactValueSchema = z
  .object({
    summary: z.string().trim().min(1),
    candidateNames: z.array(z.string().trim().min(1)).optional(),
    parentName: z.string().trim().min(1).optional(),
    locationKind: z.string().trim().min(1).optional(),
    atmosphere: z.string().trim().min(1).optional(),
    architecture: z.string().trim().min(1).optional(),
    era: z.string().trim().min(1).optional(),
    socialContext: z.string().trim().min(1).optional(),
    lighting: z.string().trim().min(1).optional(),
    colors: z.array(z.string().trim().min(1)).optional(),
    recurringObjects: z.array(z.string().trim().min(1)).optional()
  })
  .strict();

export const ExtractedLocationFactSchema = z
  .object({
    type: ExtractedLocationFactTypeSchema,
    entityName: z.string().trim().min(1),
    value: ExtractedLocationFactValueSchema,
    confidence: z.number().min(0).max(1),
    quote: z.string().trim().min(1).optional(),
    timelineHint: z.string().trim().min(1).optional()
  })
  .strict();

export const LocationExtractionResponseSchema = z
  .object({
    facts: z.array(ExtractedLocationFactSchema).optional()
  })
  .strict();

export type ExtractedLocationFact = z.infer<typeof ExtractedLocationFactSchema>;
