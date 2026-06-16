import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useJobsStore } from './jobs';

const jobsClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  listProjectJobs: vi.fn(),
  startProjectAnalysis: vi.fn(),
  stopProjectAnalysis: vi.fn()
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

  it('loads project jobs', async () => {
    jobsClientMock.listProjectJobs.mockResolvedValue([
      { id: 'job-1', status: 'FAILED', progress: 10 },
      { id: 'job-2', status: 'COMPLETED', progress: 100 }
    ]);

    const store = useJobsStore();
    await store.loadProjectJobs('project-1');

    expect(store.projectJobs['project-1']).toEqual(['job-1', 'job-2']);
    expect(store.jobs['job-1']?.status).toBe('FAILED');
    expect(store.projectStatus).toBe('success');
  });

  it('starts project analysis and tracks the returned job', async () => {
    jobsClientMock.startProjectAnalysis.mockResolvedValue({
      id: 'job-3',
      status: 'QUEUED',
      progress: 0
    });
    jobsClientMock.get.mockResolvedValue({
      id: 'job-3',
      status: 'COMPLETED',
      progress: 100
    });

    const store = useJobsStore();
    const job = await store.startProjectAnalysis('project-1');

    expect(job?.id).toBe('job-3');
    expect(store.projectJobs['project-1']).toEqual(['job-3']);
    expect(store.startStatus).toBe('success');
  });

  it('updates existing project jobs without entering loading state during silent refresh', async () => {
    jobsClientMock.listProjectJobs.mockResolvedValue([
      { id: 'job-1', status: 'PROCESSING', progress: 25 }
    ]);

    const store = useJobsStore();
    store.projectJobs['project-1'] = ['job-1'];
    store.jobs['job-1'] = { id: 'job-1', status: 'PROCESSING', progress: 10 };
    store.projectStatus = 'success';

    await store.loadProjectJobs('project-1', { silent: true });

    expect(store.projectStatus).toBe('success');
    expect(store.projectJobs['project-1']).toEqual(['job-1']);
    expect(store.jobs['job-1'].progress).toBe(25);
  });

  it('stops project analysis and stores cancelled jobs', async () => {
    jobsClientMock.stopProjectAnalysis.mockResolvedValue([
      { id: 'job-1', status: 'CANCELLED', progress: 30 }
    ]);
    jobsClientMock.listProjectJobs.mockResolvedValue([
      { id: 'job-1', status: 'CANCELLED', progress: 30 }
    ]);

    const store = useJobsStore();
    const stopped = await store.stopProjectAnalysis('project-1');

    expect(stopped).toHaveLength(1);
    expect(store.jobs['job-1']?.status).toBe('CANCELLED');
    expect(store.stopStatus).toBe('success');
  });
});
