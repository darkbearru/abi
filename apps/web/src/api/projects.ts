import type { ProjectGraph, ProjectSummary } from '@abi/shared';

import { apiTransport } from './transport';

export const projectsClient = {
  list: () => apiTransport.request<readonly ProjectSummary[]>('/projects'),
  graph: (projectId: string) => apiTransport.request<ProjectGraph>(`/projects/${projectId}/graph`)
};
