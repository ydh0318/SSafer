import { tokenStorage } from '../../../api/tokenStorage';
import type { AuthRole } from '../../../types/auth';

export const SESSION_EXPIRED_STORAGE_KEY = 'ssafer.sessionExpiredMessage';
export const SESSION_EXPIRED_MESSAGE = '세션이 만료되어 로그아웃되었습니다. 다시 로그인해 주세요.';

type JwtPayload = {
  exp?: number;
  role?: string;
};

export type TokenHealth = 'missing' | 'invalid' | 'valid';

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : normalized + '='.repeat(4 - padding);

  try {
    return window.atob(padded);
  } catch {
    return null;
  }
}

export function parseJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token) {
    return null;
  }

  const segments = token.split('.');

  if (segments.length < 2) {
    return null;
  }

  const decoded = decodeBase64Url(segments[1]);

  if (!decoded) {
    return null;
  }

  try {
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenHealth(token: string | null | undefined): TokenHealth {
  if (!token) {
    return 'missing';
  }

  return parseJwtPayload(token) ? 'valid' : 'invalid';
}

export function getTokenRole(token: string | null | undefined): AuthRole | string | null {
  return parseJwtPayload(token)?.role ?? null;
}

export function isTokenExpired(token: string | null | undefined) {
  const payload = parseJwtPayload(token);

  if (!payload) {
    return false;
  }

  if (!payload.exp) {
    return false;
  }

  return payload.exp * 1000 <= Date.now();
}

export function hasInvalidAccessToken(token: string | null | undefined) {
  return getTokenHealth(token) === 'invalid';
}

export function getStoredAccessTokenRole() {
  return getTokenRole(tokenStorage.getAccessToken());
}

export function isStoredGuestSession() {
  return getStoredAccessTokenRole() === 'GUEST';
}

export function hasStoredMemberSession() {
  const role = getStoredAccessTokenRole();
  return role === 'USER' || role === 'ADMIN' || Boolean(tokenStorage.getRefreshToken());
}

export function clearSessionWithMessage(logout: () => void) {
  logout();

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, SESSION_EXPIRED_MESSAGE);
  }
}
