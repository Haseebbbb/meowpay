import axios from 'axios';

const TOKEN_STORAGE_KEY = 'meowpay_token';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

// Scaffold only — no login flow writes to this key yet.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
