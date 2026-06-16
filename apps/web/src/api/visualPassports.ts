import { apiTransport } from './transport';

export interface VisualPassportAsset {
  readonly id: string;
  readonly passportAssetType: string;
  readonly approvalStatus: 'draft' | 'approved' | 'rejected';
  readonly localPath: string;
  readonly mimeType: string;
  readonly prompt: string;
  readonly negativePrompt?: string | null;
  readonly seed?: number | null;
  readonly provider?: string | null;
  readonly model?: string | null;
}

export interface VisualPassportResponse {
  readonly generationJobId: string;
  readonly assets: readonly VisualPassportAsset[];
}

export const visualPassportsClient = {
  generateCharacterReference: (characterVersionId: string, visualStyleId: string) =>
    apiTransport.request<VisualPassportResponse>(
      `/character-versions/${characterVersionId}/visual-passport/generate`,
      {
        method: 'POST',
        body: {
          visualStyleId,
          assetTypes: ['front_view', 'side_view', 'back_view', 'portrait']
        }
      }
    ),
  generateLocationReference: (locationVersionId: string, visualStyleId: string) =>
    apiTransport.request<VisualPassportResponse>(
      `/location-versions/${locationVersionId}/visual-passport/generate`,
      {
        method: 'POST',
        body: {
          visualStyleId,
          assetTypes: ['overview']
        }
      }
    ),
  approveCharacterAsset: (assetId: string) =>
    apiTransport.request<VisualPassportAsset>(`/assets/${assetId}/approval`, {
      method: 'PATCH',
      body: { approvalStatus: 'approved' }
    }),
  approveLocationAsset: (assetId: string) =>
    apiTransport.request<VisualPassportAsset>(
      `/location-visual-passport-assets/${assetId}/approval`,
      {
        method: 'PATCH',
        body: { approvalStatus: 'approved' }
      }
    )
};
