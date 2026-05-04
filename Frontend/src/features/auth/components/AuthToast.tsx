import { CheckCircle2, Info, X } from 'lucide-react';

type AuthToastProps = {
  message: string;
  tone?: 'success' | 'error' | 'info';
  onClose: () => void;
};

function AuthToast({ message, tone = 'info', onClose }: AuthToastProps) {
  const icon =
    tone === 'success' ? (
      <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
    ) : (
      <Info className="h-4.5 w-4.5 shrink-0 text-slate-500" />
    );

  const accentClassName =
    tone === 'success'
      ? 'before:bg-emerald-500'
      : tone === 'error'
        ? 'before:bg-rose-500'
        : 'before:bg-slate-400';

  return (
    <div
      className={`pointer-events-auto relative flex w-full max-w-[22rem] items-start gap-3 overflow-hidden rounded-[1.1rem] border border-black/6 bg-[#fffdf8]/96 px-4 py-3 text-slate-800 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-sm before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] ${accentClassName}`}
      role="status"
    >
      <div className="mt-0.5 pl-1">{icon}</div>
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

export default AuthToast;
