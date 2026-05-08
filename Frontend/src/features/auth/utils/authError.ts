import axios from 'axios';

import type { ApiErrorResponse } from '../../../types/api';
import type { OAuthProvider } from '../../../types/auth';

const TOO_MANY_REQUESTS_MESSAGE = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호가 올바르지 않습니다.';
const PASSWORD_RESET_CODE_INVALID_MESSAGE = '인증 코드가 올바르지 않습니다.';
const PASSWORD_RESET_CODE_ATTEMPTS_EXCEEDED_MESSAGE =
  '인증 코드 확인 시도가 너무 많습니다. 코드를 다시 발급받아 시도해 주세요.';
const PASSWORD_RESET_TOKEN_INVALID_MESSAGE =
  '비밀번호 재설정 세션이 유효하지 않습니다. 처음부터 다시 진행해 주세요.';

function getProviderLabel(provider: OAuthProvider) {
  return provider === 'GOOGLE' ? 'Google' : 'GitHub';
}

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

export function getOAuthLoginCancelledMessage(provider: OAuthProvider) {
  return `${getProviderLabel(provider)} 로그인 인증이 취소되었거나 완료되지 않았습니다.`;
}

export function getOAuthConfigMissingMessage(provider: OAuthProvider) {
  return `${getProviderLabel(provider)} OAuth 설정이 비어 있습니다. 프론트 환경변수와 ${getProviderLabel(provider)} Console 설정을 확인해 주세요.`;
}

export function getOAuthLoginErrorMessage(error: unknown, provider: OAuthProvider) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return `${getProviderLabel(provider)} 로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.`;
  }

  if (error.response?.status === 401) {
    return '로그인 가능한 계정이 아니거나 인증이 만료되었습니다.';
  }

  if (error.response?.status === 400) {
    return error.response?.data?.message ?? 'OAuth 요청 값이 올바르지 않습니다.';
  }

  return error.response?.data?.message ?? `${getProviderLabel(provider)} 로그인 중 문제가 발생했습니다.`;
}
