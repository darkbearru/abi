export interface AuthTokenProvider {
  getToken(): string | null;
}

export interface AuthTokenStorage extends AuthTokenProvider {
  setToken(token: string): void;
  clearToken(): void;
}

const TOKEN_STORAGE_KEY = 'abi.auth.accessToken';

class LocalStorageAuthTokenProvider implements AuthTokenStorage {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export const authTokenProvider: AuthTokenStorage = new LocalStorageAuthTokenProvider();
