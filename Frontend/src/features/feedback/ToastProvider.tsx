import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import GlobalToast, { type GlobalToastTone } from '../../components/common/GlobalToast';

type ToastInput = {
  message: string;
  tone?: GlobalToastTone;
  durationMs?: number;
};

type ToastRecord = Required<ToastInput> & {
  id: number;
};

type ToastContextValue = {
  dismissToast: (id: number) => void;
  error: (message: string, options?: Omit<ToastInput, 'message' | 'tone'>) => void;
  info: (message: string, options?: Omit<ToastInput, 'message' | 'tone'>) => void;
  showToast: (input: ToastInput) => void;
  success: (message: string, options?: Omit<ToastInput, 'message' | 'tone'>) => void;
  warning: (message: string, options?: Omit<ToastInput, 'message' | 'tone'>) => void;
};

const DEFAULT_DURATION_MS = 3200;

const ToastContext = createContext<ToastContextValue | null>(null);

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
            <GlobalToast key={toast.id} message={toast.message} onClose={() => dismissToast(toast.id)} tone={toast.tone} />
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

function useToastContext() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider.');
  }

  return context;
}

export { ToastProvider, useToastContext };
