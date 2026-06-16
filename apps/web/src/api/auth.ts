export interface AuthTokenProvider {
  getToken(): string | null;
}

export interface AuthTokenStorage extends AuthTokenProvider {
  setToken(token: string): void;
  clearToken(): void;
}

export const ACCESS_TOKEN_STORAGE_KEY = 'abi.auth.accessToken';

class MemoryAuthTokenProvider implements AuthTokenStorage {
  private token: string | null = readStoredToken();

  getToken(): string | null {
    if (this.token === null) {
      this.token = readStoredToken();
    }

    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
    getStorage()?.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  }

  clearToken(): void {
    this.token = null;
    getStorage()?.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

export const authTokenProvider: AuthTokenStorage = new MemoryAuthTokenProvider();

function readStoredToken(): string | null {
  return getStorage()?.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? null;
}

function getStorage(): Storage | undefined {
  return typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage;
}
