import axios from 'axios';

import type { ApiErrorResponse } from '../../../types/api';

const TOO_MANY_REQUESTS_MESSAGE =
  '인증 번호 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호를 다시 확인해 주세요.';
const PASSWORD_RESET_CODE_INVALID_MESSAGE = '인증번호를 다시 확인해 주세요.';
const PASSWORD_RESET_CODE_ATTEMPTS_EXCEEDED_MESSAGE =
  '인증번호 입력 횟수를 초과했습니다. 새 코드를 다시 요청해 주세요.';
const PASSWORD_RESET_TOKEN_INVALID_MESSAGE =
  '비밀번호 재설정 세션이 만료되었습니다. 처음부터 다시 진행해 주세요.';

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

export function getPasswordResetVerifyErrorMessage(error: unknown, fallbackMessage: string) {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return fallbackMessage;
  }

  if (error.response?.status === 429) {
    return PASSWORD_RESET_CODE_ATTEMPTS_EXCEEDED_MESSAGE;
  }

  if (error.response?.data?.code === 'PASSWORD_RESET_CODE_INVALID') {
    return PASSWORD_RESET_CODE_INVALID_MESSAGE;
  }

  return fallbackMessage;
}

export function getPasswordResetCompleteErrorMessage(error: unknown, fallbackMessage: string) {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return fallbackMessage;
  }

  if (error.response?.data?.code === 'PASSWORD_RESET_TOKEN_INVALID') {
    return PASSWORD_RESET_TOKEN_INVALID_MESSAGE;
  }

  return fallbackMessage;
}
