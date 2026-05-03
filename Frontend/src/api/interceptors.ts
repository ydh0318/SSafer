import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useAuthStore } from '../store/authStore';
import type { ApiSuccessResponse, TokenReissueData } from '../types/api';
import { tokenStorage } from './tokenStorage';

type RetryableRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
};

type PublicRequestRule = {
  method: string;
  matcher: (url: string) => boolean;
};

const REFRESH_PATH = '/auth/refresh';

const PUBLIC_REQUEST_RULES: PublicRequestRule[] = [
  { method: 'POST', matcher: (url) => url === '/guests/enter' },
  { method: 'POST', matcher: (url) => url === '/auth/login' },
  { method: 'POST', matcher: (url) => url === '/auth/refresh' },
  { method: 'POST', matcher: (url) => url === '/auth/email/send-code' },
  { method: 'POST', matcher: (url) => url === '/auth/email/verify-code' },
  { method: 'POST', matcher: (url) => url === '/users' },
  { method: 'GET', matcher: (url) => url.startsWith('/users/check-email') },
];

const getAuthorizationHeader = (accessToken: string) => `Bearer ${accessToken}`;

const normalizeMethod = (method?: string) => method?.toUpperCase() ?? 'GET';

const isPublicRequest = (url?: string, method?: string) => {
  if (!url) {
    return false;
  }

  const normalizedMethod = normalizeMethod(method);

  return PUBLIC_REQUEST_RULES.some(
    (rule) => rule.method === normalizedMethod && rule.matcher(url),
  );
};

const attachAccessToken = (config: InternalAxiosRequestConfig) => {
  if (isPublicRequest(config.url, config.method)) {
    config.headers.delete('Authorization');
    return config;
  }

  const accessToken = tokenStorage.getAccessToken();

  if (!accessToken) {
    return config;
  }

  config.headers.set('Authorization', getAuthorizationHeader(accessToken));
  return config;
};

export const setupInterceptors = (client: AxiosInstance) => {
  const refreshClient = axios.create({
    baseURL: client.defaults.baseURL,
    withCredentials: true,
  });

  client.interceptors.request.use((config) => attachAccessToken(config));

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiSuccessResponse<TokenReissueData>>) => {
      const originalRequest = error.config as RetryableRequestConfig | undefined;
      const status = error.response?.status;
      const requestUrl = originalRequest?.url ?? '';
      const requestMethod = originalRequest?.method;
      const isRefreshRequest = requestUrl.includes(REFRESH_PATH);
      const requestIsPublic = isPublicRequest(requestUrl, requestMethod);
      const currentRefreshToken = tokenStorage.getRefreshToken();

      if (
        !originalRequest ||
        status !== 401 ||
        originalRequest._retry ||
        isRefreshRequest ||
        requestIsPublic ||
        !currentRefreshToken
      ) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const refreshResponse = await refreshClient.post<ApiSuccessResponse<TokenReissueData>>(
          REFRESH_PATH,
          { refreshToken: currentRefreshToken },
        );
        const nextTokens = refreshResponse.data.data;

        useAuthStore.getState().setTokens({
          accessToken: nextTokens.accessToken,
          refreshToken: nextTokens.refreshToken,
        });
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = getAuthorizationHeader(nextTokens.accessToken);

        return client(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    },
  );
};
