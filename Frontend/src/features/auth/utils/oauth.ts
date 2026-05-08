import type { OAuthProvider } from '../../../types/auth';

import { ROUTES } from '../../../constants/routes';

const GOOGLE_OAUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GITHUB_OAUTH_BASE_URL = 'https://github.com/login/oauth/authorize';
const GOOGLE_OAUTH_SCOPE = ['openid', 'email', 'profile'].join(' ');
const GITHUB_OAUTH_SCOPE = ['read:user', 'user:email'].join(' ');
const OAUTH_STATE_STORAGE_KEY = 'ssafer.oauth.pending';
export const OAUTH_RESULT_STORAGE_KEY = 'ssafer.oauth.result';

export type OAuthIntent = 'login' | 'connect';

type PendingOAuthState = {
  state: string;
  provider: OAuthProvider;
  intent: OAuthIntent;
};

function canUseSessionStorage() {
  return typeof window !== 'undefined';
}

function getOrigin() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.origin;
}

function createOAuthStateValue() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function readPendingOAuthState() {
  if (!canUseSessionStorage()) {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PendingOAuthState;
  } catch {
    return null;
  }
}

function writePendingOAuthState(value: PendingOAuthState) {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, JSON.stringify(value));
}

export function clearPendingOAuthState() {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
}

export function setOAuthResultMessage(message: string) {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(OAUTH_RESULT_STORAGE_KEY, message);
}

export function consumeOAuthResultMessage() {
  if (!canUseSessionStorage()) {
    return null;
  }

  const message = window.sessionStorage.getItem(OAUTH_RESULT_STORAGE_KEY);

  if (!message) {
    return null;
  }

  window.sessionStorage.removeItem(OAUTH_RESULT_STORAGE_KEY);
  return message;
}

export function getOAuthRedirectUri(provider: OAuthProvider) {
  const origin = getOrigin();

  switch (provider) {
    case 'GOOGLE':
      return `${origin}${ROUTES.oauthGoogleCallback}`;
    case 'GITHUB':
      return `${origin}${ROUTES.oauthGithubCallback}`;
  }
}

function getOAuthClientId(provider: OAuthProvider) {
  if (provider === 'GOOGLE') {
    return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
  }

  return import.meta.env.VITE_GITHUB_CLIENT_ID?.trim() ?? '';
}

function isPlaceholderClientId(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    !normalized ||
    normalized.includes('your-google-oauth-client-id') ||
    normalized.includes('your-github-oauth-client-id') ||
    normalized.includes('your-') ||
    normalized.includes('example') ||
    normalized.includes('placeholder')
  );
}

export function getOAuthProviderLabel(provider: OAuthProvider) {
  return provider === 'GOOGLE' ? 'Google' : 'GitHub';
}

export function buildOAuthStartUrl(provider: OAuthProvider, intent: OAuthIntent) {
  const clientId = getOAuthClientId(provider);

  if (!clientId || isPlaceholderClientId(clientId)) {
    return null;
  }

  const state = createOAuthStateValue();
  writePendingOAuthState({
    state,
    provider,
    intent,
  });

  if (provider === 'GOOGLE') {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getOAuthRedirectUri(provider),
      response_type: 'code',
      scope: GOOGLE_OAUTH_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `${GOOGLE_OAUTH_BASE_URL}?${params.toString()}`;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getOAuthRedirectUri(provider),
    scope: GITHUB_OAUTH_SCOPE,
    state,
  });

  return `${GITHUB_OAUTH_BASE_URL}?${params.toString()}`;
}

export function resolveOAuthCallbackIntent(provider: OAuthProvider, state: string | null) {
  const pendingState = readPendingOAuthState();

  if (!pendingState || !state) {
    return null;
  }

  if (pendingState.provider !== provider || pendingState.state !== state) {
    return null;
  }

  clearPendingOAuthState();
  return pendingState.intent;
}
