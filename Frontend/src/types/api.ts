export interface ApiSuccessResponse<T> {
  message: string;
  data: T;
}

export type ApiFieldErrors = Record<string, string | undefined>;

export interface ApiErrorResponse<T = { fieldErrors?: ApiFieldErrors }> {
  message: string;
  data?: T;
}

export interface TokenReissueData {
  accessToken: string;
  timeout: number;
}
