import { z } from 'zod';

const OptionalTextSchema = z
  .union([z.string(), z.number(), z.boolean(), z.null()])
  .optional()
  .transform(toOptionalText);
const RequiredTextSchema = OptionalTextSchema.transform((value) => value ?? 'Unknown');
const StringArraySchema = z
  .preprocess(toStringArray, z.array(z.string().trim().min(1)))
  .optional();
const ConfidenceSchema = z
  .preprocess(toConfidence, z.number().min(0).max(1))
  .catch(0.5);

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
    summary: OptionalTextSchema,
    candidateNames: z.array(z.string().trim().min(1)).optional(),
    parentName: OptionalTextSchema,
    locationKind: OptionalTextSchema,
    atmosphere: OptionalTextSchema,
    architecture: OptionalTextSchema,
    era: OptionalTextSchema,
    socialContext: OptionalTextSchema,
    lighting: OptionalTextSchema,
    colors: StringArraySchema,
    recurringObjects: StringArraySchema
  })
  .passthrough();

export const ExtractedLocationFactSchema = z
  .object({
    type: ExtractedLocationFactTypeSchema,
    entityName: RequiredTextSchema,
    value: ExtractedLocationFactValueSchema,
    confidence: ConfidenceSchema,
    quote: OptionalTextSchema,
    timelineHint: OptionalTextSchema
  })
  .passthrough();

export const LocationExtractionResponseSchema = z.preprocess(
  toResponseObject,
  z
    .object({
      facts: z
        .array(z.unknown())
        .optional()
        .transform((facts) => parseFacts(facts ?? []))
    })
    .passthrough()
);

export type ExtractedLocationFact = z.infer<typeof ExtractedLocationFactSchema>;
export type LocationExtractionResponse = z.infer<typeof LocationExtractionResponseSchema>;

function parseFacts(facts: readonly unknown[]): ExtractedLocationFact[] {
  return facts.flatMap((fact) => {
    const parsed = ExtractedLocationFactSchema.safeParse(fact);

    return parsed.success ? [parsed.data] : [];
  });
}

function toResponseObject(value: unknown): unknown {
  return Array.isArray(value) ? { facts: value } : value;
}

function toOptionalText(value: string | number | boolean | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const trimmed = String(value).trim();

  return trimmed.length === 0 ? undefined : trimmed;
}

function toStringArray(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];

  return values
    .filter((item): item is string | number | boolean => {
      return ['string', 'number', 'boolean'].includes(typeof item);
    })
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
}

function toConfidence(value: unknown): number {
  if (typeof value === 'number') {
    return value > 1 && value <= 100 ? value / 100 : value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    const numeric = Number(normalized);

    if (!Number.isNaN(numeric)) {
      return numeric > 1 && numeric <= 100 ? numeric / 100 : numeric;
    }

    if (normalized === 'high') {
      return 0.85;
    }

    if (normalized === 'medium') {
      return 0.6;
    }

    if (normalized === 'low') {
      return 0.35;
    }
  }

  return 0.5;
}
