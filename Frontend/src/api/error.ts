import axios from 'axios';

import type { ApiErrorResponse } from '../types/api';

const DEFAULT_MESSAGE = '요청 처리 중 오류가 발생했습니다.';

export function getApiErrorMessage(error: unknown, fallbackMessage = DEFAULT_MESSAGE) {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? fallbackMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}
