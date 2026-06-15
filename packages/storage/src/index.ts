import { DynamicModule, Inject, Injectable, Module, Optional } from '@nestjs/common';

export interface StorageObject {
  readonly key: string;
  readonly contentType: string;
}

export interface PutObjectRequest {
  readonly key: string;
  readonly body: Uint8Array;
  readonly contentType: string;
}

export interface StorageProvider {
  putObject(request: PutObjectRequest): Promise<StorageObject>;
}

export const STORAGE_PROVIDER = 'ABI_STORAGE_PROVIDER';

export interface StorageModuleOptions {
  readonly provider: StorageProvider;
}

export class StorageProviderNotConfiguredError extends Error {
  constructor() {
    super('Storage provider is not configured.');
    this.name = 'StorageProviderNotConfiguredError';
  }
}

@Injectable()
export class StorageService implements StorageProvider {
  constructor(
    @Optional()
    @Inject(STORAGE_PROVIDER)
    private readonly provider?: StorageProvider
  ) {}

  putObject(request: PutObjectRequest): Promise<StorageObject> {
    if (!this.provider) {
      throw new StorageProviderNotConfiguredError();
    }

    return this.provider.putObject(request);
  }
}

@Module({
  providers: [StorageService],
  exports: [StorageService]
})
export class StorageModule {
  static register(options: StorageModuleOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_PROVIDER,
          useValue: options.provider
        },
        StorageService
      ],
      exports: [STORAGE_PROVIDER, StorageService]
    };
  }
}
