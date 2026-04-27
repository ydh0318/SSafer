export interface ApiSuccessResponse<T> {
  message: string;
  data: T;
}

export interface TokenReissueData {
  accessToken: string;
  timeout: number;
}
