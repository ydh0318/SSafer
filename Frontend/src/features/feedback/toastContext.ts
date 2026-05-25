import { createContext, useContext } from 'react';

import type { GlobalToastTone } from '../../components/common/GlobalToast';

export type ToastInput = {
  message: string;
  tone?: GlobalToastTone;
  durationMs?: number;
};

export type ToastContextValue = {
  dismissToast: (id: number) => void;
  error: (message: string, options?: Omit<ToastInput, 'message' | 'tone'>) => void;
  info: (message: string, options?: Omit<ToastInput, 'message' | 'tone'>) => void;
  showToast: (input: ToastInput) => void;
  success: (message: string, options?: Omit<ToastInput, 'message' | 'tone'>) => void;
  warning: (message: string, options?: Omit<ToastInput, 'message' | 'tone'>) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function useToastContext() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider.');
  }

  return context;
}

export { ToastContext, useToastContext };
