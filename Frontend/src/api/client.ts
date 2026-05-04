import axios from 'axios';

import { setupInterceptors } from './interceptors';

const envBaseURL = import.meta.env.VITE_API_BASE_URL;
const isDevelopment = import.meta.env.DEV;

if (!envBaseURL && !isDevelopment) {
  throw new Error('VITE_API_BASE_URL is required outside the local development environment.');
}

const baseURL = envBaseURL ?? 'http://localhost:8080/api/v1';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

setupInterceptors(apiClient);
