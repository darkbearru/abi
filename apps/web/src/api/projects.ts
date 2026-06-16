import type { ProjectGraph, ProjectSummary } from '@abi/shared';

import { apiTransport } from './transport';

export const projectsClient = {
  list: () => apiTransport.request<readonly ProjectSummary[]>('/projects'),
  updateSettings: (projectId: string, input: { readonly visualStyleId?: string | null }) =>
    apiTransport.request<ProjectSummary>(`/projects/${projectId}/settings`, {
      method: 'PATCH',
      body: { ...input }
    }),
  graph: (projectId: string) => apiTransport.request<ProjectGraph>(`/projects/${projectId}/graph`),
  characterGraph: (projectId: string, characterId: string) =>
    apiTransport.request<ProjectGraph>(`/projects/${projectId}/characters/${characterId}/graph`)
};
