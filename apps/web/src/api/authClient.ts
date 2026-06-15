import type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from '@abi/shared';

import { authTokenProvider } from './auth';
import { apiTransport } from './transport';

export const authClient = {
  async register(input: RegisterRequest): Promise<AuthResponse> {
    const response = await apiTransport.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { ...input }
    });
    authTokenProvider.setToken(response.accessToken);

    return response;
  },

  async login(input: LoginRequest): Promise<AuthResponse> {
    const response = await apiTransport.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { ...input }
    });
    authTokenProvider.setToken(response.accessToken);

    return response;
  },

  me: () => apiTransport.request<AuthUser>('/auth/me')
};
