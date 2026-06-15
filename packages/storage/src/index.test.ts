import { describe, expect, it } from 'vitest';

import {
  StorageProviderNotConfiguredError,
  StorageService,
  type StorageProvider
} from './index.js';

describe('StorageService', () => {
  it('delegates object writes to the configured provider', async () => {
    const provider: StorageProvider = {
      putObject: (request) =>
        Promise.resolve({
          key: request.key,
          contentType: request.contentType
        })
    };
    const service = new StorageService(provider);

    await expect(
      service.putObject({
        key: 'books/example.txt',
        body: new Uint8Array([1, 2, 3]),
        contentType: 'text/plain'
      })
    ).resolves.toEqual({
      key: 'books/example.txt',
      contentType: 'text/plain'
    });
  });

  it('throws a typed error without a configured provider', () => {
    const service = new StorageService();

    expect(() =>
      service.putObject({
        key: 'missing',
        body: new Uint8Array(),
        contentType: 'application/octet-stream'
      })
    ).toThrow(StorageProviderNotConfiguredError);
  });
});
