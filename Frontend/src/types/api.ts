export interface ApiSuccessResponse<T> {
  message: string;
  data: T;
}

export interface ApiErrorResponse<T = Record<string, never>> {
  code: string;
  message: string;
  data: T;
}

export interface TokenReissueData {
  accessToken: string;
  timeout: number;
}
