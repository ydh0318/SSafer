import { type ReactNode,useCallback, useEffect, useMemo, useRef, useState } from 'react';

import GlobalToast from '../../components/common/GlobalToast';
import { ToastContext, type ToastContextValue, type ToastInput } from './toastContext';

type ToastRecord = Required<ToastInput> & {
  id: number;
};

const DEFAULT_DURATION_MS = 3200;

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextToastIdRef = useRef(1);
  const timeoutMapRef = useRef<Map<number, number>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timeoutId = timeoutMapRef.current.get(id);

    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutMapRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, tone = 'info', durationMs = DEFAULT_DURATION_MS }: ToastInput) => {
      const nextId = nextToastIdRef.current++;
      const nextToast: ToastRecord = {
        id: nextId,
        message,
        tone,
        durationMs,
      };

      setToasts((current) => [...current, nextToast]);

      const timeoutId = window.setTimeout(() => {
        dismissToast(nextId);
      }, durationMs);

      timeoutMapRef.current.set(nextId, timeoutId);
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      timeoutMapRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutMapRef.current.clear();
    },
    [],
  );

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      dismissToast,
      showToast,
      success: (message, options) => showToast({ message, tone: 'success', durationMs: options?.durationMs }),
      error: (message, options) => showToast({ message, tone: 'error', durationMs: options?.durationMs }),
      warning: (message, options) => showToast({ message, tone: 'warning', durationMs: options?.durationMs }),
      info: (message, options) => showToast({ message, tone: 'info', durationMs: options?.durationMs }),
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed right-6 top-6 z-50 flex flex-col gap-3">
          {toasts.map((toast) => (
            <GlobalToast
              key={toast.id}
              message={toast.message}
              onClose={() => dismissToast(toast.id)}
              tone={toast.tone}
            />
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export { ToastProvider };
