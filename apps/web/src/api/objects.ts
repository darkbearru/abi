import type { WorldObject } from '@abi/shared';

import { apiTransport } from './transport';

export const objectsClient = {
  list: (projectId: string) =>
    apiTransport.request<readonly WorldObject[]>(`/projects/${projectId}/objects`)
};
