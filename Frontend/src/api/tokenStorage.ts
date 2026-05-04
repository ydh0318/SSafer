import { STORAGE_KEYS } from '../constants/storageKeys';

let inMemoryAccessToken: string | null = null;

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
};
