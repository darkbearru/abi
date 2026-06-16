import type { GenerationJob } from '@abi/shared';

import { apiTransport } from './transport';

export const jobsClient = {
  get: (jobId: string) => apiTransport.request<GenerationJob>(`/jobs/${jobId}`),
  listProjectJobs: (projectId: string) =>
    apiTransport.request<readonly GenerationJob[]>(`/projects/${projectId}/jobs`),
  startProjectAnalysis: (projectId: string) =>
    apiTransport.request<GenerationJob>(`/projects/${projectId}/analysis/start`, { method: 'POST' }),
  stopProjectAnalysis: (projectId: string) =>
    apiTransport.request<readonly GenerationJob[]>(`/projects/${projectId}/analysis/stop`, {
      method: 'POST'
    })
};
