import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authTokenProvider } from '../api';
import { useAuthStore } from './auth';

const authClientMock = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  me: vi.fn()
}));

const authTokenProviderMock = vi.hoisted(() => ({
  getToken: () => localStorage.getItem('abi.auth.accessToken'),
  setToken: (token: string) => {
    localStorage.setItem('abi.auth.accessToken', token);
  },
  clearToken: () => {
    localStorage.removeItem('abi.auth.accessToken');
  }
}));

vi.mock('../api', () => {
  return {
    authClient: authClientMock,
    authTokenProvider: authTokenProviderMock
  };
});

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('stores login session', async () => {
    authClientMock.login.mockResolvedValue({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      expiresInSeconds: 3600,
      user: { id: 'user-1', email: 'reader@example.com', name: 'Reader' }
    });

    const store = useAuthStore();
    await store.login({ email: 'reader@example.com', password: 'super-secret' });

    expect(store.isAuthenticated).toBe(true);
    expect(store.user?.email).toBe('reader@example.com');
    expect(authTokenProvider.getToken()).toBe('jwt-token');
  });

  it('clears session on logout', () => {
    localStorage.setItem('abi.auth.accessToken', 'jwt-token');
    localStorage.setItem(
      'abi.auth.user',
      JSON.stringify({ id: 'user-1', email: 'reader@example.com', name: null })
    );

    const store = useAuthStore();
    store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(authTokenProvider.getToken()).toBeNull();
    expect(localStorage.getItem('abi.auth.user')).toBeNull();
  });
});
