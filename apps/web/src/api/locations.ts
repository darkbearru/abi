import type { Location } from '@abi/shared';

import { apiTransport } from './transport';

export const locationsClient = {
  list: (projectId: string) =>
    apiTransport.request<readonly Location[]>(`/projects/${projectId}/locations`)
};
