import { STORAGE_KEYS } from '../constants/storageKeys';

let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

const canUseStorage = () => typeof window !== 'undefined';

export const tokenStorage = {
  getAccessToken() {
    if (inMemoryAccessToken) {
      return inMemoryAccessToken;
    }

    if (!canUseStorage()) {
      return null;
    }

    const storedToken = window.localStorage.getItem(STORAGE_KEYS.accessToken);
    inMemoryAccessToken = storedToken;
    return storedToken;
  },

  setAccessToken(token: string) {
    inMemoryAccessToken = token;

    if (!canUseStorage()) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.accessToken, token);
  },

  clearAccessToken() {
    inMemoryAccessToken = null;

    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(STORAGE_KEYS.accessToken);
  },

  getRefreshToken() {
    if (inMemoryRefreshToken) {
      return inMemoryRefreshToken;
    }

    if (!canUseStorage()) {
      return null;
    }

    const storedToken = window.localStorage.getItem(STORAGE_KEYS.refreshToken);
    inMemoryRefreshToken = storedToken;
    return storedToken;
  },

  setRefreshToken(token: string) {
    inMemoryRefreshToken = token;

    if (!canUseStorage()) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.refreshToken, token);
  },

  clearRefreshToken() {
    inMemoryRefreshToken = null;

    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(STORAGE_KEYS.refreshToken);
  },

  setTokens({
    accessToken,
    refreshToken,
  }: {
    accessToken: string;
    refreshToken?: string | null;
  }) {
    this.setAccessToken(accessToken);

    if (refreshToken) {
      this.setRefreshToken(refreshToken);
    } else if (refreshToken === null) {
      this.clearRefreshToken();
    }
  },

  clearTokens() {
    this.clearAccessToken();
    this.clearRefreshToken();
  },
};
