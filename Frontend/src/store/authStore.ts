import { create } from 'zustand';

import { tokenStorage } from '../api/tokenStorage';
import { useProjectStore } from './projectStore';
import type { AuthUser } from '../types/auth';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAccessToken: (accessToken: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  setTokens: (params: { accessToken: string; refreshToken?: string | null }) => void;
  setUser: (user: AuthUser | null) => void;
  login: (params: {
    accessToken: string;
    refreshToken?: string | null;
    user: AuthUser | null;
  }) => void;
  logout: () => void;
}

const initialAccessToken = tokenStorage.getAccessToken();
const initialRefreshToken = tokenStorage.getRefreshToken();

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: initialAccessToken,
  refreshToken: initialRefreshToken,
  user: null,
  isAuthenticated: Boolean(initialAccessToken),
  setAccessToken: (accessToken) => {
    if (accessToken) {
      tokenStorage.setAccessToken(accessToken);
    } else {
      tokenStorage.clearAccessToken();
    }

    set({
      accessToken,
      isAuthenticated: Boolean(accessToken),
    });
  },
  setRefreshToken: (refreshToken) => {
    if (refreshToken) {
      tokenStorage.setRefreshToken(refreshToken);
    } else {
      tokenStorage.clearRefreshToken();
    }

    set({ refreshToken });
  },
  setTokens: ({ accessToken, refreshToken }) => {
    tokenStorage.setTokens({ accessToken, refreshToken });

    set({
      accessToken,
      refreshToken: refreshToken === undefined ? tokenStorage.getRefreshToken() : refreshToken,
      isAuthenticated: true,
    });
  },
  setUser: (user) => {
    set({ user });
  },
  login: ({ accessToken, refreshToken, user }) => {
    tokenStorage.setTokens({ accessToken, refreshToken });

    set({
      accessToken,
      refreshToken: refreshToken ?? null,
      user,
      isAuthenticated: true,
    });
  },
  logout: () => {
    tokenStorage.clearTokens();
    useProjectStore.getState().reset();

    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
