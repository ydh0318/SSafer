import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

export type GlobalToastTone = 'success' | 'error' | 'warning' | 'info';

type GlobalToastProps = {
  message: string;
  onClose: () => void;
  tone?: GlobalToastTone;
};

const toneClassNameMap: Record<GlobalToastTone, string> = {
  success: 'before:bg-emerald-500',
  error: 'before:bg-rose-500',
  warning: 'before:bg-amber-500',
  info: 'before:bg-slate-400',
};

function getToastIcon(tone: GlobalToastTone) {
  switch (tone) {
    case 'success':
      return <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600" />;
    case 'error':
      return <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-600" />;
    case 'warning':
      return <TriangleAlert className="h-4.5 w-4.5 shrink-0 text-amber-600" />;
    case 'info':
    default:
      return <Info className="h-4.5 w-4.5 shrink-0 text-slate-500" />;
  }
}

function GlobalToast({ message, onClose, tone = 'info' }: GlobalToastProps) {
  return (
    <div
      className={`pointer-events-auto relative flex w-full max-w-[22rem] items-start gap-3 overflow-hidden rounded-[1.1rem] border border-black/6 bg-[#fffdf8]/96 px-4 py-3 text-slate-800 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-sm before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] ${toneClassNameMap[tone]}`}
      role="status"
    >
      <div className="mt-0.5 pl-1">{getToastIcon(tone)}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.92rem] font-semibold leading-6 text-slate-800">{message}</p>
      </div>
      <button
        aria-label="Close notification"
        className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
        onClick={onClose}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default GlobalToast;
