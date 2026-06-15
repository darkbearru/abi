import type { GenerationJob } from '@abi/shared';

import { apiTransport } from './transport';

export const jobsClient = {
  get: (jobId: string) => apiTransport.request<GenerationJob>(`/jobs/${jobId}`)
};
