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

const REISSUE_PATH = '/auth/reissue';
const PUBLIC_PATH_PREFIXES = ['/guests/enter', '/auth', '/users'];

const getAuthorizationHeader = (accessToken: string) => `Bearer ${accessToken}`;

const isPublicRequestPath = (url?: string) => {
  if (!url) {
    return false;
  }

  return PUBLIC_PATH_PREFIXES.some((prefix) => url.startsWith(prefix));
};

const extractAccessToken = (response: ApiSuccessResponse<TokenReissueData>, header?: string) => {
  const tokenFromBody = response.data?.accessToken;

  if (tokenFromBody) {
    return tokenFromBody;
  }

  if (header?.startsWith('Bearer ')) {
    return header.replace('Bearer ', '');
  }

  return null;
};

const attachAccessToken = (config: InternalAxiosRequestConfig) => {
  if (isPublicRequestPath(config.url)) {
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
      const isReissueRequest = requestUrl.includes(REISSUE_PATH);
      const isPublicRequest = isPublicRequestPath(requestUrl);

      if (
        !originalRequest ||
        status !== 401 ||
        originalRequest._retry ||
        isReissueRequest ||
        isPublicRequest
      ) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const reissueResponse =
          await refreshClient.post<ApiSuccessResponse<TokenReissueData>>(REISSUE_PATH);
        const nextAccessToken = extractAccessToken(
          reissueResponse.data,
          reissueResponse.headers.authorization,
        );

        if (!nextAccessToken) {
          throw new Error('Access token was not returned from reissue API.');
        }

        useAuthStore.getState().setAccessToken(nextAccessToken);
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = getAuthorizationHeader(nextAccessToken);

        return client(originalRequest);
      } catch (reissueError) {
        useAuthStore.getState().logout();
        return Promise.reject(reissueError);
      }
    },
  );
};
