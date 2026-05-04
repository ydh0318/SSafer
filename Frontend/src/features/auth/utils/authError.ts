import axios from 'axios';

import type { ApiErrorResponse } from '../../../types/api';

const TOO_MANY_REQUESTS_MESSAGE =
  '인증 번호 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호를 다시 확인해 주세요.';

export function getTooManyRequestsMessage(error: unknown, fallbackMessage: string) {
  if (axios.isAxiosError<ApiErrorResponse>(error) && error.response?.status === 429) {
    return TOO_MANY_REQUESTS_MESSAGE;
  }

  return fallbackMessage;
}

export function getLoginErrorMessage(error: unknown) {
  if (
    axios.isAxiosError<ApiErrorResponse>(error) &&
    (error.response?.status === 401 || error.response?.status === 403)
  ) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  return INVALID_CREDENTIALS_MESSAGE;
}
