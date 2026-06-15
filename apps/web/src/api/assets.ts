import type { Asset } from '@abi/shared';

import { apiTransport } from './transport';

export const assetsClient = {
  list: (projectId: string) =>
    apiTransport.request<readonly Asset[]>(`/projects/${projectId}/assets`),
  validate: (assetId: string) =>
    apiTransport.request<unknown>(`/assets/${assetId}/validate`, { method: 'POST' }),
  fileUrl: (assetId: string) => apiTransport.assetFileUrl(assetId),
  assetUrl: (localPath: string) => apiTransport.assetUrl(localPath)
};
