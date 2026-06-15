import { LocalStorageProvider } from '@abi/storage';

export class LocalPassportStorageProvider extends LocalStorageProvider {
  constructor(storageRoot = process.env.STORAGE_ROOT ?? './storage') {
    super({ rootDir: storageRoot });
  }
}
