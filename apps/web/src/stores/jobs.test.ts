import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useJobsStore } from './jobs';

const jobsClientMock = vi.hoisted(() => ({
  get: vi.fn()
}));

vi.mock('../api', () => ({
  jobsClient: jobsClientMock
}));

describe('jobs store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('stores terminal job progress', async () => {
    jobsClientMock.get.mockResolvedValue({
      id: 'job-1',
      status: 'COMPLETED',
      progress: 100
    });

    const store = useJobsStore();
    await store.pollJob('job-1');

    expect(store.jobs['job-1']).toEqual({
      id: 'job-1',
      status: 'COMPLETED',
      progress: 100
    });
    expect(store.errors['job-1']).toBeUndefined();
  });

  it('stores polling errors by job id', async () => {
    jobsClientMock.get.mockRejectedValue(new Error('Job not found'));

    const store = useJobsStore();
    await store.pollJob('missing-job');

    expect(store.errors['missing-job']).toBe('Job not found');
  });
});
