import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useAuthStore } from '../store/authStore';
import type { ApiSuccessResponse } from '../types/api';
import type { AuthTokenData, RefreshTokenRequest } from '../types/auth';
import { tokenStorage } from './tokenStorage';

type RetryableRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
  skipAuth?: boolean;
};

const REFRESH_PATH = '/auth/refresh';
const REFRESH_TOKEN_MISSING_MESSAGE =
  'Refresh API completed but did not return an access token in the response body or Authorization header.';

const getAuthorizationHeader = (accessToken: string) => `Bearer ${accessToken}`;

const extractAccessToken = (response: ApiSuccessResponse<AuthTokenData>, header?: string) => {
  const tokenFromBody = response.data?.accessToken;

  if (tokenFromBody) {
    return tokenFromBody;
  }

  if (header?.startsWith('Bearer ')) {
    return header.replace('Bearer ', '');
  }

  return null;
};

const requestTokenRefresh = async (refreshClient: AxiosInstance, refreshToken: string) => {
  const payload: RefreshTokenRequest = { refreshToken };
  const refreshResponse = await refreshClient.post<ApiSuccessResponse<AuthTokenData>>(
    REFRESH_PATH,
    payload,
  );
  const nextAccessToken = extractAccessToken(
    refreshResponse.data,
    refreshResponse.headers.authorization,
  );

  if (!nextAccessToken) {
    throw new Error(REFRESH_TOKEN_MISSING_MESSAGE);
  }

  return {
    accessToken: nextAccessToken,
    refreshToken: refreshResponse.data.data?.refreshToken,
  };
};

const attachAccessToken = (config: InternalAxiosRequestConfig) => {
  if ((config as RetryableRequestConfig).skipAuth) {
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
    async (error: AxiosError<ApiSuccessResponse<AuthTokenData>>) => {
      const originalRequest = error.config as RetryableRequestConfig | undefined;
      const status = error.response?.status;
      const requestUrl = originalRequest?.url ?? '';
      const isRefreshRequest = requestUrl.includes(REFRESH_PATH);
      const refreshToken = tokenStorage.getRefreshToken();

      if (
        !originalRequest ||
        status !== 401 ||
        originalRequest._retry ||
        originalRequest.skipAuth ||
        isRefreshRequest ||
        !refreshToken
      ) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const nextTokens = await requestTokenRefresh(refreshClient, refreshToken);
        useAuthStore.getState().setTokens(nextTokens);
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
