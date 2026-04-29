import axios from 'axios';

import { setupInterceptors } from './interceptors';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

setupInterceptors(apiClient);
