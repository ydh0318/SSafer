import { create } from 'zustand';
import { tokenStorage } from '../api/tokenStorage';
import type { AuthUser } from '../types/auth';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAccessToken: (accessToken: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  login: (params: { accessToken: string; user: AuthUser | null }) => void;
  logout: () => void;
}

const initialAccessToken = tokenStorage.getAccessToken();

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: initialAccessToken,
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
  setUser: (user) => {
    set({
      user,
    });
  },
  login: ({ accessToken, user }) => {
    tokenStorage.setAccessToken(accessToken);

    set({
      accessToken,
      user,
      isAuthenticated: true,
    });
  },
  logout: () => {
    tokenStorage.clearAccessToken();

    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
