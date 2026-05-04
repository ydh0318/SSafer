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
