import { apiClient, publicApiClient } from '../../../api/client';
import { tokenStorage } from '../../../api/tokenStorage';
import type { ApiSuccessResponse } from '../../../types/api';
import type {
  AuthTokenData,
  ChangePasswordRequest,
  CheckEmailAvailabilityData,
  LoginRequest,
  LogoutRequest,
  PasswordResetCompleteRequest,
  PasswordResetSendCodeRequest,
  PasswordResetVerifyCodeData,
  PasswordResetVerifyCodeRequest,
  RefreshTokenRequest,
  RegisterUserData,
  RegisterUserRequest,
  SendEmailVerificationCodeRequest,
  VerifyEmailCodeRequest,
} from '../../../types/auth';

export async function loginWithEmail(payload: LoginRequest) {
  const response = await apiClient.post<ApiSuccessResponse<AuthTokenData>>('/auth/login', payload);
  return response.data.data;
}

export async function refreshAuthTokens(payload: RefreshTokenRequest) {
  const response = await apiClient.post<ApiSuccessResponse<AuthTokenData>>('/auth/refresh', payload);
  return response.data.data;
}

export async function logoutCurrentUser() {
  const refreshToken = tokenStorage.getRefreshToken();

  if (!refreshToken) {
    return;
  }

  const payload: LogoutRequest = { refreshToken };
  await apiClient.post<ApiSuccessResponse<null>>('/auth/logout', payload);
}

export async function checkEmailAvailability(email: string) {
  const response = await publicApiClient.get<ApiSuccessResponse<CheckEmailAvailabilityData>>(
    '/users/check-email',
    {
      params: { email },
    },
  );

  return response.data.data;
}

export async function sendEmailVerificationCode(payload: SendEmailVerificationCodeRequest) {
  await publicApiClient.post<ApiSuccessResponse<null>>('/auth/email/send-code', payload);
}

export async function verifyEmailCode(payload: VerifyEmailCodeRequest) {
  await publicApiClient.post<ApiSuccessResponse<null>>('/auth/email/verify-code', payload);
}

export async function registerUser(payload: RegisterUserRequest) {
  const response = await publicApiClient.post<ApiSuccessResponse<RegisterUserData>>(
    '/users',
    payload,
  );
  return response.data.data;
}

export async function changeCurrentUserPassword(payload: ChangePasswordRequest) {
  const response = await apiClient.patch<ApiSuccessResponse<AuthTokenData>>(
    '/users/me/password',
    payload,
  );
  return response.data.data;
}

export async function sendPasswordResetCode(payload: PasswordResetSendCodeRequest) {
  await publicApiClient.post<ApiSuccessResponse<null>>('/auth/password-reset/send-code', payload);
}

export async function verifyPasswordResetCode(payload: PasswordResetVerifyCodeRequest) {
  const response = await publicApiClient.post<ApiSuccessResponse<PasswordResetVerifyCodeData>>(
    '/auth/password-reset/verify-code',
    payload,
  );
  return response.data.data;
}

export async function completePasswordReset(payload: PasswordResetCompleteRequest) {
  await publicApiClient.post<ApiSuccessResponse<null>>('/auth/password-reset/complete', payload);
}

export async function withdrawCurrentUser() {
  await apiClient.delete<ApiSuccessResponse<null>>('/users');
}
