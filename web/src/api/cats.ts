import { apiClient } from './client';

export interface CatSummary {
  id: string;
  name: string;
  email: string;
}

export interface MeResult {
  id: string;
  name: string;
  email: string;
  balance: number;
}

export async function getMe(): Promise<MeResult> {
  const response = await apiClient.get<MeResult>('/me');
  return response.data;
}

export async function searchCats(query: string): Promise<CatSummary[]> {
  const response = await apiClient.get<CatSummary[]>('/cats/search', { params: { q: query } });
  return response.data;
}
