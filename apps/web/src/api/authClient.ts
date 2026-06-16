import type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from '@abi/shared';

import { apiTransport } from './transport';

export const authClient = {
  async register(input: RegisterRequest): Promise<AuthResponse> {
    return apiTransport.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { ...input }
    });
  },

  async login(input: LoginRequest): Promise<AuthResponse> {
    return apiTransport.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { ...input }
    });
  },

  me: () => apiTransport.request<AuthUser>('/auth/me'),
  logout: () => apiTransport.request<unknown>('/auth/logout', { method: 'POST' })
};
