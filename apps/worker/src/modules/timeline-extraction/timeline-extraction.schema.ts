import { z } from 'zod';

export const ExtractedTimelineFactTypeSchema = z.enum([
  'TIMELINE_EVENT',
  'TIMELINE_MARKER',
  'TIMELINE_CHARACTER_PERIOD',
  'TIMELINE_CANDIDATE'
]);

export const ExtractedTimelineFactValueSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    absoluteDate: z.string().datetime({ offset: true }).optional(),
    relativeMarker: z.string().trim().min(1).optional(),
    relativeOrderHint: z
      .enum([
        'before',
        'after',
        'same_time',
        'childhood',
        'next_day',
        'year_later',
        'unknown'
      ])
      .optional(),
    anchorEventTitle: z.string().trim().min(1).optional(),
    characterNames: z.array(z.string().trim().min(1)).optional(),
    locationNames: z.array(z.string().trim().min(1)).optional(),
    periodName: z.string().trim().min(1).optional(),
    candidateNames: z.array(z.string().trim().min(1)).optional()
  })
  .strict();

export const ExtractedTimelineFactSchema = z
  .object({
    type: ExtractedTimelineFactTypeSchema,
    entityName: z.string().trim().min(1),
    value: ExtractedTimelineFactValueSchema,
    confidence: z.number().min(0).max(1),
    quote: z.string().trim().min(1).optional(),
    timelineHint: z.string().trim().min(1).optional()
  })
  .strict();

export const TimelineExtractionResponseSchema = z
  .object({
    facts: z.array(ExtractedTimelineFactSchema).optional()
  })
  .strict();

export type ExtractedTimelineFact = z.infer<typeof ExtractedTimelineFactSchema>;
