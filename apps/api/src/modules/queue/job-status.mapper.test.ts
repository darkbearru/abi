import { describe, expect, it } from 'vitest';

import { mapGenerationJobToResponse } from './job-status.mapper.js';

describe('mapGenerationJobToResponse', () => {
  it('maps persisted generation job status to API response', () => {
    expect(
      mapGenerationJobToResponse({
        id: 'job-1',
        projectId: 'project-1',
        userId: null,
        sceneId: null,
        bookAnalysisId: 'analysis-1',
        visualStyleId: null,
        status: 'PROCESSING',
        progress: 45,
        input: {
          queueName: 'book-analysis',
          name: 'analyze-book',
          payload: { bookId: 'book-1' }
        },
        output: null,
        error: null,
        createdAt: new Date('2026-06-15T00:00:00.000Z'),
        updatedAt: new Date('2026-06-15T00:01:00.000Z')
      })
    ).toEqual({
      id: 'job-1',
      projectId: 'project-1',
      userId: null,
      sceneId: null,
      bookAnalysisId: 'analysis-1',
      queueName: 'book-analysis',
      name: 'analyze-book',
      status: 'PROCESSING',
      progress: 45,
      input: {
        queueName: 'book-analysis',
        name: 'analyze-book',
        payload: { bookId: 'book-1' }
      },
      output: null,
      error: null,
      createdAt: '2026-06-15T00:00:00.000Z',
      updatedAt: '2026-06-15T00:01:00.000Z'
    });
  });
});
