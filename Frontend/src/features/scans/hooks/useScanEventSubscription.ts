import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useEffect, useRef } from 'react';

import { useAuthStore } from '../../../store/authStore';

const envBaseURL = import.meta.env.VITE_API_BASE_URL;
const isDevelopment = import.meta.env.DEV;
const baseURL = envBaseURL ?? (isDevelopment ? '/api/v1' : '');

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
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              if (response.status === 401 || response.status === 403) {
                // Ignore auth errors, likely token expired and will be refreshed or logged out
                return;
              }
              throw new Error('Fatal SSE error');
            }
          },
          onmessage: (msg) => {
            if (msg.event === 'scan.completed') {
              try {
                const data = JSON.parse(msg.data);
                if (data.scanId && onCompletedRef.current) {
                  onCompletedRef.current(data.scanId);
                }
              } catch (e) {
                // Ignore JSON parsing errors
              }
            } else if (msg.event === 'scan.failed') {
              try {
                const data = JSON.parse(msg.data);
                if (data.scanId && onFailedRef.current) {
                  onFailedRef.current(data.scanId);
                }
              } catch (e) {
                // Ignore JSON parsing errors
              }
            }
          },
          onerror: (err) => {
            // Rethrow to let it retry automatically, or just swallow to avoid unhandled rejections
          },
        });
      } catch (err) {
        // SSE connection completely failed or aborted
      }
    };

    void connect();

    return () => {
      abortController.abort();
    };
  }, [accessToken]);
}
