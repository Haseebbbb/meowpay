import { apiClient } from './client';

export interface AuthenticatedCat {
  id: string;
  name: string;
  email: string;
}

export interface AuthResult {
  token: string;
  cat: AuthenticatedCat;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const response = await apiClient.post<AuthResult>('/auth/login', { email, password });
  return response.data;
}

export async function signup(name: string, email: string, password: string): Promise<AuthResult> {
  const response = await apiClient.post<AuthResult>('/auth/signup', { name, email, password });
  return response.data;
}
