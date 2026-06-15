import type { ExtractedFactType, Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { LocationMergeService } from './location-merge.service.js';
import type { MergeableLocationFact } from './location-merge.types.js';

describe('LocationMergeService', () => {
  it('builds parent-child merge plan for nested locations and objects', () => {
    const service = new LocationMergeService({} as PrismaService);
    const plan = service.createMergePlan([
      fact('f1', 'LOCATION_MENTION', 'Old City', { summary: 'Old City.', locationKind: 'city' }),
      fact('f2', 'LOCATION_HIERARCHY', 'Park', {
        summary: 'Park is inside Old City.',
        parentName: 'Old City',
        locationKind: 'park'
      }),
      fact('f3', 'LOCATION_HIERARCHY', 'Fountain', {
        summary: 'Fountain is inside Park.',
        parentName: 'Park',
        locationKind: 'object'
      })
    ]);

    expect(plan.locations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Old City' }),
        expect.objectContaining({ name: 'Park', parentName: 'Old City' }),
        expect.objectContaining({ name: 'Fountain', parentName: 'Park' })
      ])
    );
  });

  it('detects possible duplicate locations without merging them automatically', () => {
    const service = new LocationMergeService({} as PrismaService);
    const plan = service.createMergePlan([
      fact('f1', 'LOCATION_MENTION', 'Old Park', { summary: 'A park.' }),
      fact('f2', 'LOCATION_MENTION', 'The Old Park', { summary: 'Likely the same park.' })
    ]);

    expect(plan.locations).toHaveLength(2);
    expect(plan.conflicts).toEqual([
      expect.objectContaining({
        type: 'LOCATION_POSSIBLE_DUPLICATE',
        sourceFactIds: ['f1', 'f2']
      })
    ]);
  });
});

function fact(
  id: string,
  type: ExtractedFactType,
  entityName: string,
  value: Prisma.JsonObject,
  confidence = 0.8,
  chapterIndex = 1,
  timelineHint?: string
): MergeableLocationFact {
  return {
    id,
    type,
    entityName,
    value,
    confidence,
    chapterIndex,
    ...(timelineHint === undefined ? {} : { timelineHint })
  };
}
