import { apiClient } from '../../../api/client';
import { tokenStorage } from '../../../api/tokenStorage';
import type { ApiSuccessResponse } from '../../../types/api';
import type {
  AuthTokenData,
  ChangePasswordRequest,
  CheckEmailAvailabilityData,
  LoginRequest,
  LogoutRequest,
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
  const response = await apiClient.get<ApiSuccessResponse<CheckEmailAvailabilityData>>(
    '/users/check-email',
    {
      params: { email },
    },
  );

  return response.data.data;
}

export async function sendEmailVerificationCode(payload: SendEmailVerificationCodeRequest) {
  await apiClient.post<ApiSuccessResponse<null>>('/auth/email/send-code', payload);
}

export async function verifyEmailCode(payload: VerifyEmailCodeRequest) {
  await apiClient.post<ApiSuccessResponse<null>>('/auth/email/verify-code', payload);
}

export async function registerUser(payload: RegisterUserRequest) {
  const response = await apiClient.post<ApiSuccessResponse<RegisterUserData>>('/users', payload);
  return response.data.data;
}

export async function changeCurrentUserPassword(payload: ChangePasswordRequest) {
  const response = await apiClient.patch<ApiSuccessResponse<AuthTokenData>>(
    '/users/me/password',
    payload,
  );
  return response.data.data;
}

export async function withdrawCurrentUser() {
  await apiClient.delete<ApiSuccessResponse<null>>('/users');
}
