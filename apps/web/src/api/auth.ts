export interface AuthTokenProvider {
  getToken(): string | null;
}

export interface AuthTokenStorage extends AuthTokenProvider {
  setToken(token: string): void;
  clearToken(): void;
}

class MemoryAuthTokenProvider implements AuthTokenStorage {
  private token: string | null = null;

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }
}

export const authTokenProvider: AuthTokenStorage = new MemoryAuthTokenProvider();
