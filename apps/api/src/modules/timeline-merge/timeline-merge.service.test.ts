import type { ExtractedFactType, Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { TimelineMergeService } from './timeline-merge.service.js';
import type { MergeableTimelineFact } from './timeline-merge.types.js';

describe('TimelineMergeService', () => {
  it('orders events by chapter and stable relative order', () => {
    const service = new TimelineMergeService({} as PrismaService);
    const plan = service.createMergePlan([
      fact('f2', 2, 'Second event', { title: 'Second event' }, 0.8),
      fact('f1', 1, 'First event', { title: 'First event' }, 0.9)
    ]);

    expect(plan.events.map((event) => event.title)).toEqual([
      'First event',
      'Second event'
    ]);
    const firstEvent = plan.events[0];
    const secondEvent = plan.events[1];

    expect(firstEvent).toBeDefined();
    expect(secondEvent).toBeDefined();
    expect(firstEvent?.relativeOrder).toBeLessThan(secondEvent?.relativeOrder ?? 0);
  });

  it('keeps implicit relative markers in ordering metadata', () => {
    const service = new TimelineMergeService({} as PrismaService);
    const plan = service.createMergePlan([
      fact(
        'f1',
        4,
        'Mara reigns',
        {
          title: 'Mara reigns',
          description: 'Mara becomes queen.',
          characterNames: ['Mara']
        },
        0.9
      ),
      fact(
        'f2',
        5,
        'Mara childhood',
        {
          title: 'Mara childhood',
          description: 'Mara lives by the river in childhood.',
          relativeMarker: 'in childhood',
          relativeOrderHint: 'childhood',
          characterNames: ['Mara'],
          periodName: 'childhood'
        },
        0.85
      ),
      fact(
        'f3',
        4,
        'Mara returns',
        {
          title: 'Mara returns',
          description: 'Mara returns on the next day.',
          relativeMarker: 'the next day',
          relativeOrderHint: 'next_day',
          anchorEventTitle: 'Mara reigns',
          characterNames: ['Mara']
        },
        0.8
      )
    ]);

    expect(plan.events.map((event) => event.title)).toEqual([
      'Mara childhood',
      'Mara reigns',
      'Mara returns'
    ]);
    const childhoodEvent = plan.events[0];
    const returnEvent = plan.events[2];

    expect(childhoodEvent).toBeDefined();
    expect(returnEvent).toBeDefined();
    expect(childhoodEvent?.relativeMarkers).toMatchObject({
      relativeOrderHint: 'childhood',
      periodName: 'childhood'
    });
    expect(returnEvent?.relativeMarkers).toMatchObject({
      relativeOrderHint: 'next_day',
      anchorEventTitle: 'Mara reigns'
    });
  });
});

function fact(
  id: string,
  chapterIndex: number,
  entityName: string,
  value: Prisma.InputJsonObject,
  confidence: number,
  type: ExtractedFactType = 'TIMELINE_EVENT'
): MergeableTimelineFact {
  return {
    id,
    type,
    entityName,
    value: value as Prisma.JsonValue,
    sourceChunkId: `chunk-${id}`,
    confidence,
    chapterIndex,
    createdAt: new Date(`2026-01-01T00:00:0${id.slice(1)}.000Z`)
  };
}
