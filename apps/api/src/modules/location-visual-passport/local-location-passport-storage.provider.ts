import { LocalStorageProvider } from '@abi/storage';

export class LocalLocationPassportStorageProvider extends LocalStorageProvider {
  constructor(storageRoot = process.env.STORAGE_ROOT ?? './storage') {
    super({ rootDir: storageRoot });
  }
}
