import { useState } from 'react';

import { useAuthStore } from '../../../store/authStore';
import { enterGuestMode } from '../api/guest';

function getGuestErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : '게스트 모드 진입에 실패했습니다. 잠시 후 다시 시도해주세요.';
}

function useGuestEntry() {
  const login = useAuthStore((state) => state.login);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startGuestEntry = async () => {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const session = await enterGuestMode();

      login({
        accessToken: session.guestAccessToken,
        refreshToken: null,
        user: {
          id: `guest:${session.expiresAt}`,
          email: 'guest@ssafer.local',
          name: 'Guest User',
          role: 'GUEST',
        },
      });

      return true;
    } catch (error) {
      setErrorMessage(getGuestErrorMessage(error));
      return false;
    } finally {
      setIsPending(false);
    }
  };

  const clearError = () => {
    setErrorMessage(null);
  };

  return {
    clearError,
    errorMessage,
    isPending,
    startGuestEntry,
  };
}

export default useGuestEntry;
