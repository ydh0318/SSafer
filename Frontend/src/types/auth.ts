export type AuthRole = 'GUEST' | 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: AuthRole | string;
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
  confirmPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: AuthUser | null;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
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
  code: string;
  displayName: string;
  password: string;
}

export interface RegisterUserData {
  userId?: string;
  email: string;
  displayName: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface GuestEnterRequest {
  deviceId: string;
}

export interface GuestEnterData {
  accessToken: string;
  role: 'GUEST';
}
