import type { SceneGenerationRequest, SceneGenerationResponse } from '@abi/shared';

import { apiTransport } from './transport';

export const scenesClient = {
  generate: (projectId: string, input: SceneGenerationRequest) =>
    apiTransport.request<SceneGenerationResponse>(`/projects/${projectId}/scenes/generate`, {
      method: 'POST',
      body: { ...input }
    })
};
