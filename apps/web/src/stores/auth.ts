import type { AsyncStatus, AuthResponse, AuthUser, LoginRequest, RegisterRequest } from '@abi/shared';
import { defineStore } from 'pinia';

import { authClient, authTokenProvider } from '../api';

const USER_STORAGE_KEY = 'abi.auth.user';

interface AuthState {
  status: AsyncStatus;
  error: string | null;
  user: AuthUser | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    status: authTokenProvider.getToken() ? 'loading' : 'idle',
    error: null,
    user: readStoredUser()
  }),
  getters: {
    isAuthenticated(state): boolean {
      return authTokenProvider.getToken() !== null && state.user !== null;
    }
  },
  actions: {
    async register(input: RegisterRequest): Promise<void> {
      await this.authenticate(() => authClient.register(input));
    },

    async login(input: LoginRequest): Promise<void> {
      await this.authenticate(() => authClient.login(input));
    },

    async loadCurrentUser(): Promise<void> {
      if (authTokenProvider.getToken() === null) {
        this.clearSession();
        return;
      }

      this.status = 'loading';
      this.error = null;

      try {
        this.setUser(await authClient.me());
        this.status = 'success';
      } catch (error) {
        this.clearSession();
        this.error = error instanceof Error ? error.message : 'Unable to load current user';
        this.status = 'error';
      }
    },

    logout(): void {
      this.clearSession();
    },

    async authenticate(request: () => Promise<AuthResponse>): Promise<void> {
      this.status = 'loading';
      this.error = null;

      try {
        const response = await request();
        authTokenProvider.setToken(response.accessToken);
        this.setUser(response.user);
        this.status = 'success';
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Authentication failed';
        this.status = 'error';
        throw error;
      }
    },

    setUser(user: AuthUser): void {
      this.user = user;
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    },

    clearSession(): void {
      authTokenProvider.clearToken();
      localStorage.removeItem(USER_STORAGE_KEY);
      this.user = null;
      this.status = 'idle';
      this.error = null;
    }
  }
});

function readStoredUser(): AuthUser | null {
  const stored = localStorage.getItem(USER_STORAGE_KEY);

  if (stored === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<AuthUser>;

    if (typeof parsed.id === 'string' && typeof parsed.email === 'string') {
      return {
        id: parsed.id,
        email: parsed.email,
        name: typeof parsed.name === 'string' ? parsed.name : null
      };
    }
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
  }

  return null;
}
