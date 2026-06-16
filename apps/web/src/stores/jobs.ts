import type { AsyncStatus, GenerationJob } from '@abi/shared';
import { defineStore } from 'pinia';

import { jobsClient } from '../api';

interface JobsState {
  jobs: Record<string, GenerationJob>;
  errors: Record<string, string>;
  projectJobs: Record<string, readonly string[]>;
  projectStatus: AsyncStatus;
  projectError: string | null;
  startStatus: AsyncStatus;
  startError: string | null;
  stopStatus: AsyncStatus;
  stopError: string | null;
}

const POLL_INTERVAL_MS = 2500;
const PROJECT_POLL_INTERVAL_MS = 5000;
const terminalStatuses = new Set<GenerationJob['status']>([
  'COMPLETED',
  'FAILED',
  'CANCELLED'
]);
const projectPollTimers = new Map<string, number>();

export const useJobsStore = defineStore('jobs', {
  state: (): JobsState => ({
    jobs: {},
    errors: {},
    projectJobs: {},
    projectStatus: 'idle',
    projectError: null,
    startStatus: 'idle',
    startError: null,
    stopStatus: 'idle',
    stopError: null
  }),
  actions: {
    async loadProjectJobs(
      projectId: string,
      options: { readonly silent?: boolean } = {}
    ): Promise<void> {
      const hasExistingJobs = (this.projectJobs[projectId]?.length ?? 0) > 0;

      if (!options.silent && !hasExistingJobs) {
        this.projectStatus = 'loading';
      }
      this.projectError = null;

      try {
        const jobs = await jobsClient.listProjectJobs(projectId);

        this.storeJobs(jobs);
        this.setProjectJobIds(projectId, jobs.map((job) => job.id));
        this.projectStatus = 'success';
        this.scheduleProjectPolling(projectId, jobs);
      } catch (error) {
        this.projectError = error instanceof Error ? error.message : 'Unable to load jobs';
        if (!options.silent) {
          this.projectStatus = 'error';
        }
      }
    },

    async startProjectAnalysis(projectId: string): Promise<GenerationJob | null> {
      this.startStatus = 'loading';
      this.startError = null;

      try {
        const job = await jobsClient.startProjectAnalysis(projectId);

        this.storeJobs([job]);
        this.setProjectJobIds(projectId, [
          job.id,
          ...(this.projectJobs[projectId] ?? []).filter((jobId) => jobId !== job.id)
        ]);
        this.startStatus = 'success';
        void this.pollJob(job.id);
        this.scheduleProjectPolling(projectId, [job]);

        return job;
      } catch (error) {
        this.startError = error instanceof Error ? error.message : 'Unable to start analysis';
        this.startStatus = 'error';

        return null;
      }
    },

    async stopProjectAnalysis(projectId: string): Promise<readonly GenerationJob[]> {
      this.stopStatus = 'loading';
      this.stopError = null;

      try {
        const stoppedJobs = await jobsClient.stopProjectAnalysis(projectId);

        this.storeJobs(stoppedJobs);
        this.stopStatus = 'success';
        await this.loadProjectJobs(projectId, { silent: true });

        return stoppedJobs;
      } catch (error) {
        this.stopError = error instanceof Error ? error.message : 'Unable to stop analysis';
        this.stopStatus = 'error';

        return [];
      }
    },

    async pollJob(jobId: string): Promise<void> {
      try {
        const job = await jobsClient.get(jobId);

        this.storeJobs([job]);
        this.errors = Object.fromEntries(
          Object.entries(this.errors).filter(([id]) => id !== jobId)
        );

        if (!terminalStatuses.has(job.status)) {
          window.setTimeout(() => {
            void this.pollJob(jobId);
          }, POLL_INTERVAL_MS);
        }
      } catch (error) {
        this.errors[jobId] = error instanceof Error ? error.message : 'Unable to load job';
      }
    },

    storeJobs(jobs: readonly GenerationJob[]): void {
      for (const job of jobs) {
        this.jobs[job.id] = {
          ...(this.jobs[job.id] ?? {}),
          ...job
        };
      }
    },

    setProjectJobIds(projectId: string, jobIds: readonly string[]): void {
      const current = this.projectJobs[projectId] ?? [];
      const changed =
        current.length !== jobIds.length ||
        current.some((jobId, index) => jobId !== jobIds[index]);

      if (changed) {
        this.projectJobs[projectId] = [...jobIds];
      }
    },

    scheduleProjectPolling(projectId: string, jobs: readonly GenerationJob[]): void {
      if (jobs.every((job) => terminalStatuses.has(job.status))) {
        const timer = projectPollTimers.get(projectId);

        if (timer !== undefined) {
          window.clearTimeout(timer);
          projectPollTimers.delete(projectId);
        }

        return;
      }

      if (projectPollTimers.has(projectId)) {
        return;
      }

      const timer = window.setTimeout(() => {
        projectPollTimers.delete(projectId);
        void this.loadProjectJobs(projectId, { silent: true });
      }, PROJECT_POLL_INTERVAL_MS);

      projectPollTimers.set(projectId, timer);
    }
  }
});
