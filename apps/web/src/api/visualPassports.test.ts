import { describe, expect, it, vi } from 'vitest';

const requestMock = vi.hoisted(() => vi.fn());

vi.mock('./transport', () => ({
  apiTransport: {
    request: requestMock
  }
}));

import { visualPassportsClient } from './visualPassports';

describe('visualPassportsClient', () => {
  it('requests the four required character passport views', async () => {
    requestMock.mockResolvedValue({ generationJobId: 'job-1', assets: [] });

    await visualPassportsClient.generateCharacterReference('character-version-1', 'style-1');

    expect(requestMock).toHaveBeenCalledWith(
      '/character-versions/character-version-1/visual-passport/generate',
      {
        method: 'POST',
        body: {
          visualStyleId: 'style-1',
          assetTypes: ['front_view', 'side_view', 'back_view', 'portrait']
        }
      }
    );
  });
});
