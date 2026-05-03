export type AuthRole = 'GUEST' | 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: AuthRole;
}

export interface GuestEnterRequest {
  deviceId?: string;
}

export interface GuestEnterData {
  guestAccessToken: string;
  expiresAt: string;
}

export interface CheckEmailAvailabilityData {
  available: boolean;
}

export interface SendEmailVerificationCodeRequest {
  email: string;
}

export interface VerifyEmailCodeRequest {
  email: string;
  code: string;
}

export interface RegisterUserRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface RegisterUserData {
  userId: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokenData {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface SignupFormValues {
  email: string;
  code: string;
  displayName: string;
  password: string;
}
