import type { Character } from '@abi/shared';

import { apiTransport } from './transport';

export const charactersClient = {
  list: (projectId: string) =>
    apiTransport.request<readonly Character[]>(`/projects/${projectId}/characters`)
};
