import type { GenerationJob } from '@abi/shared';
import { defineStore } from 'pinia';

import { jobsClient } from '../api';

interface JobsState {
  jobs: Record<string, GenerationJob>;
  errors: Record<string, string>;
}

const POLL_INTERVAL_MS = 2500;
const terminalStatuses = new Set<GenerationJob['status']>([
  'COMPLETED',
  'FAILED',
  'CANCELLED'
]);

export const useJobsStore = defineStore('jobs', {
  state: (): JobsState => ({
    jobs: {},
    errors: {}
  }),
  actions: {
    async pollJob(jobId: string): Promise<void> {
      try {
        const job = await jobsClient.get(jobId);

        this.jobs[jobId] = job;
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
    }
  }
});
