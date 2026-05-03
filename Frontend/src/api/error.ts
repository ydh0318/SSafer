import axios from 'axios';

import type { ApiErrorResponse, ApiFieldErrors } from '../types/api';

const DEFAULT_MESSAGE = 'Something went wrong while communicating with the server.';

export function getApiErrorMessage(error: unknown, fallbackMessage = DEFAULT_MESSAGE) {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? fallbackMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

export function getApiFieldErrors(error: unknown) {
  if (!axios.isAxiosError<ApiErrorResponse<{ fieldErrors?: ApiFieldErrors }>>(error)) {
    return {};
  }

  return error.response?.data?.data?.fieldErrors ?? {};
}
