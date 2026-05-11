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
    let retryCount = 0;
    const MAX_RETRIES = 5;

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
                throw new Error('Auth error');
              }
              throw new Error('Fatal SSE error');
            }
            
            // 연결 성공 시 재시도 횟수 초기화
            retryCount = 0;
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
            // Error 발생 시 지수 백오프(Exponential Backoff)로 재시도
            retryCount += 1;
            
            if (retryCount >= MAX_RETRIES) {
              throw new Error('Max retries exceeded'); // throw 시 재시도 중단
            }
            
            // 최대 10초 내에서 1s -> 2s -> 4s -> 8s 단위로 지연시간 증가
            return Math.min(1000 * (2 ** (retryCount - 1)), 10000);
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
