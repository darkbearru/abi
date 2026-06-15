import type { ExtractedFactType, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { CharacterMergeService } from './character-merge.service.js';
import type { MergeableExtractedFact } from './character-merge.types.js';

describe('CharacterMergeService', () => {
  it('groups aliases through candidate names and creates a canonical name', () => {
    const service = createService();
    const plan = service.createMergePlan([
      fact('f1', 'CHARACTER_MENTION', 'John', {
        summary: 'John appears.',
        candidateNames: ['Johnny', 'Mr. Smith']
      }),
      fact('f2', 'CHARACTER_ALIAS', 'Johnny', {
        summary: 'Johnny is another mention.',
        candidateNames: ['John']
      })
    ]);

    expect(plan.characters).toHaveLength(1);
    expect(plan.characters[0]).toMatchObject({
      canonicalName: 'John',
      aliases: ['Johnny', 'Mr. Smith']
    });
  });

  it('splits character versions on age and meaningful appearance changes', () => {
    const service = createService();
    const plan = service.createMergePlan([
      fact('f1', 'CHARACTER_AGE', 'Mira', { summary: 'Mira is a child.' }, 0.9, 1),
      fact('f2', 'CHARACTER_APPEARANCE', 'Mira', { summary: 'Mira has short hair.' }, 0.8, 1),
      fact('f3', 'CHARACTER_AGE', 'Mira', { summary: 'Mira is an adult.' }, 0.9, 8),
      fact('f4', 'CHARACTER_APPEARANCE', 'Mira', { summary: 'Mira has silver hair.' }, 0.8, 8)
    ]);

    expect(plan.characters).toHaveLength(1);
    expect(plan.characters[0]?.versions).toHaveLength(2);
    expect(plan.characters[0]?.versions.map((version) => version.age)).toEqual([
      'Mira is a child.',
      'Mira is an adult.'
    ]);
    expect(plan.characters[0]?.versions.at(-1)?.appearance).toMatchObject({
      summary: 'Mira has silver hair.'
    });
  });

  it('detects conflicting attributes without overwriting either source fact', () => {
    const service = createService();
    const plan = service.createMergePlan([
      fact('f1', 'CHARACTER_APPEARANCE', 'Ada', { summary: 'Ada has blue eyes.' }),
      fact('f2', 'CHARACTER_APPEARANCE', 'Ada', { summary: 'Ada has green eyes.' })
    ]);

    expect(plan.conflicts).toEqual([
      expect.objectContaining({
        type: 'CHARACTER_ATTRIBUTE_CONFLICT',
        characterCanonicalName: 'Ada',
        sourceFactIds: ['f1', 'f2']
      })
    ]);
  });

  it('builds merge context from all project and series book analyses', async () => {
    const worldBibleCreate = vi.fn().mockResolvedValue({ id: 'world-bible-series' });
    const service = new CharacterMergeService({
      userBookProject: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'project-1',
          seriesId: 'series-1',
          bookAnalysisId: 'analysis-primary',
          worldBible: null,
          bookAnalysis: {
            id: 'analysis-primary',
            worldBible: null
          },
          books: [
            { bookAnalysisId: 'analysis-1', bookAnalysis: { id: 'analysis-1' } },
            { bookAnalysisId: 'analysis-2', bookAnalysis: { id: 'analysis-2' } }
          ],
          series: {
            worldBible: null,
            books: [
              { book: { analyses: [{ id: 'analysis-3' }] } },
              { book: { analyses: [{ id: 'analysis-1' }] } }
            ]
          }
        })
      },
      worldBible: {
        create: worldBibleCreate
      }
    } as unknown as PrismaService);

    const context = await (service as unknown as MergeContextReader).getMergeContext('project-1');

    expect(context).toEqual({
      bookAnalysisIds: ['analysis-1', 'analysis-2', 'analysis-3', 'analysis-primary'],
      worldBibleId: 'world-bible-series'
    });
    expect(worldBibleCreate).toHaveBeenCalledWith({
      data: { seriesId: 'series-1' },
      select: { id: true }
    });
  });
});

interface MergeContextReader {
  getMergeContext(
    projectId: string
  ): Promise<{ readonly bookAnalysisIds: readonly string[]; readonly worldBibleId: string }>;
}

function createService(): CharacterMergeService {
  return new CharacterMergeService({} as PrismaService);
}

function fact(
  id: string,
  type: ExtractedFactType,
  entityName: string,
  value: Prisma.JsonObject,
  confidence = 0.8,
  chapterIndex = 1,
  timelineHint?: string
): MergeableExtractedFact {
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
