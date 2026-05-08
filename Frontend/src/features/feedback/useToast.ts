import { useToastContext } from './ToastProvider';

export function useToast() {
  return useToastContext();
}
