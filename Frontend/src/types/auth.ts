export type AuthRole = 'GUEST' | 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: AuthRole | string;
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

export interface CheckNicknameAvailabilityData {
  available: boolean;
}

export interface UserProfileData {
  email: string;
  displayName: string;
}

export interface UpdateUserProfileRequest {
  displayName: string;
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
  code?: string;
}

export interface RegisterUserData {
  userId?: number | string;
  email?: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokenData {
  accessToken: string;
  accessTokenExpiresAt?: string;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
}

export type OAuthProvider = 'GOOGLE' | 'GITHUB';

export interface OAuthLoginRequest {
  provider: OAuthProvider;
  authorizationCode?: string;
  redirectUri?: string;
  confirmRejoin?: boolean;
  rejoinToken?: string;
}

export interface OAuthLoginData extends AuthTokenData {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  displayName: string;
  newUserCreated: boolean;
  userId: number | string;
  accountStatus: string;
}

export interface RejoinRequiredData {
  rejoinToken: string;
}

export interface SocialAccount {
  provider: OAuthProvider;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

export interface SocialAccountsData {
  socials: SocialAccount[];
}

export interface SocialConnectRequest {
  authorizationCode: string;
  redirectUri: string;
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

export interface PasswordResetSendCodeRequest {
  email: string;
}

export interface PasswordResetVerifyCodeRequest {
  email: string;
  code: string;
}

export interface PasswordResetVerifyCodeData {
  resetToken: string;
}

export interface PasswordResetCompleteRequest {
  resetToken: string;
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
  confirmPassword: string;
}
