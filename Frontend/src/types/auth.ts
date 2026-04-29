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
