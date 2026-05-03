import { STORAGE_KEYS } from '../constants/storageKeys';

let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

const canUseStorage = () => typeof window !== 'undefined';

const getStoredValue = (key: string) => {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(key);
};

const setStoredValue = (key: string, value: string) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, value);
};

const clearStoredValue = (key: string) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
};

export const tokenStorage = {
  getAccessToken() {
    if (inMemoryAccessToken) {
      return inMemoryAccessToken;
    }

    const storedToken = getStoredValue(STORAGE_KEYS.accessToken);
    inMemoryAccessToken = storedToken;
    return storedToken;
  },

  setAccessToken(token: string) {
    inMemoryAccessToken = token;
    setStoredValue(STORAGE_KEYS.accessToken, token);
  },

  clearAccessToken() {
    inMemoryAccessToken = null;
    clearStoredValue(STORAGE_KEYS.accessToken);
  },

  getRefreshToken() {
    if (inMemoryRefreshToken) {
      return inMemoryRefreshToken;
    }

    const storedToken = getStoredValue(STORAGE_KEYS.refreshToken);
    inMemoryRefreshToken = storedToken;
    return storedToken;
  },

  setRefreshToken(token: string) {
    inMemoryRefreshToken = token;
    setStoredValue(STORAGE_KEYS.refreshToken, token);
  },

  clearRefreshToken() {
    inMemoryRefreshToken = null;
    clearStoredValue(STORAGE_KEYS.refreshToken);
  },

  setTokens(params: { accessToken: string; refreshToken?: string | null }) {
    this.setAccessToken(params.accessToken);

    if (params.refreshToken) {
      this.setRefreshToken(params.refreshToken);
    } else if (params.refreshToken === null) {
      this.clearRefreshToken();
    }
  },

  clearTokens() {
    this.clearAccessToken();
    this.clearRefreshToken();
  },
};
