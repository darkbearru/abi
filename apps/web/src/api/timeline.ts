import type { TimelineEvent } from '@abi/shared';

import { apiTransport } from './transport';

export const timelineClient = {
  list: (projectId: string) =>
    apiTransport.request<readonly TimelineEvent[]>(`/projects/${projectId}/timeline`)
};
