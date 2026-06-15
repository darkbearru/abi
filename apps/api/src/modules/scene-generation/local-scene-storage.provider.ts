import { LocalStorageProvider } from '@abi/storage';

export class LocalSceneStorageProvider extends LocalStorageProvider {
  constructor(storageRoot = process.env.STORAGE_ROOT ?? './storage') {
    super({ rootDir: storageRoot });
  }
}
