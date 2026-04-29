import { STORAGE_KEYS } from '../constants/storageKeys';

export function getGuestDeviceId() {
  if (typeof window === 'undefined') {
    return 'web-guest-device';
  }

  const stored = window.localStorage.getItem(STORAGE_KEYS.guestDeviceId);

  if (stored) {
    return stored;
  }

  const nextId = `web-guest-${crypto.randomUUID()}`;
  window.localStorage.setItem(STORAGE_KEYS.guestDeviceId, nextId);
  return nextId;
}
