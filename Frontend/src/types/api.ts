export interface ApiSuccessResponse<T> {
  message: string;
  data: T;
}

export type ApiFieldErrors = Record<string, string>;

export interface ApiErrorResponse<T = Record<string, never>> {
  code: string;
  message: string;
  data: T;
}

export interface TokenReissueData {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}
