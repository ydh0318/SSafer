import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

type AuthMessageProps = {
  tone?: 'error' | 'success' | 'info';
  message: string;
};

function AuthMessage({ tone = 'info', message }: AuthMessageProps) {
  const icon =
    tone === 'error' ? (
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
    ) : tone === 'success' ? (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
    ) : (
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
    );

  const className =
    tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-slate-200 bg-white text-slate-600';

  return (
    <div className={`flex items-start gap-2 border px-4 py-3 text-sm ${className}`}>
      {icon}
      <span>{message}</span>
    </div>
  );
}

export default AuthMessage;
