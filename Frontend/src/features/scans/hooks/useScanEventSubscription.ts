import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useEffect, useRef } from 'react';

import { useAuthStore } from '../../../store/authStore';

const envBaseURL = import.meta.env.VITE_API_BASE_URL;
const isDevelopment = import.meta.env.DEV;
const baseURL = envBaseURL ?? (isDevelopment ? '/api/v1' : '');
const SSE_NOT_AVAILABLE_ERROR = 'SSE_NOT_AVAILABLE';

export function useScanEventSubscription(
  onCompleted?: (scanId: number) => void,
  onFailed?: (scanId: number) => void,
) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const onCompletedRef = useRef(onCompleted);
  const onFailedRef = useRef(onFailed);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
    onFailedRef.current = onFailed;
  }, [onCompleted, onFailed]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const abortController = new AbortController();
    let retryCount = 0;
    const MAX_RETRIES = 5;
    let isSseUnavailable = false;

    const connect = async () => {
      try {
        await fetchEventSource(`${baseURL}/scan-events/subscribe`, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${accessToken}`,
          },
          signal: abortController.signal,
          onopen: async (response) => {
            if (response.status === 404) {
              isSseUnavailable = true;
              throw new Error(SSE_NOT_AVAILABLE_ERROR);
            }

            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              if (response.status === 401 || response.status === 403) {
                throw new Error('Auth error');
              }

              throw new Error('Fatal SSE error');
            }

            retryCount = 0;
          },
          onmessage: (msg) => {
            if (msg.event === 'scan.completed') {
              try {
                const data = JSON.parse(msg.data);
                if (data.scanId && onCompletedRef.current) {
                  onCompletedRef.current(data.scanId);
                }
              } catch {
                // Ignore JSON parsing errors.
              }
            } else if (msg.event === 'scan.failed') {
              try {
                const data = JSON.parse(msg.data);
                if (data.scanId && onFailedRef.current) {
                  onFailedRef.current(data.scanId);
                }
              } catch {
                // Ignore JSON parsing errors.
              }
            }
          },
          onerror: () => {
            if (isSseUnavailable) {
              throw new Error(SSE_NOT_AVAILABLE_ERROR);
            }

            retryCount += 1;

            if (retryCount >= MAX_RETRIES) {
              throw new Error('Max retries exceeded');
            }

            return Math.min(1000 * (2 ** (retryCount - 1)), 10000);
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message === SSE_NOT_AVAILABLE_ERROR) {
          return;
        }

        // Ignore transient connection failures and rely on polling as fallback.
      }
    };

    void connect();

    return () => {
      abortController.abort();
    };
  }, [accessToken]);
}
