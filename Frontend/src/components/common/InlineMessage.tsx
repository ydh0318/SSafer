import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

type InlineMessageTone = 'success' | 'error' | 'warning' | 'info';

type InlineMessageProps = {
  message: ReactNode;
  tone?: InlineMessageTone;
  className?: string;
};

const toneClassNameMap: Record<InlineMessageTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
};

function getInlineMessageIcon(tone: InlineMessageTone) {
  switch (tone) {
    case 'success':
      return <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0" />;
    case 'error':
      return <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0" />;
    case 'warning':
      return <TriangleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0" />;
    case 'info':
    default:
      return <Info className="mt-0.5 h-4.5 w-4.5 shrink-0" />;
  }
}

function InlineMessage({ message, tone = 'info', className = '' }: InlineMessageProps) {
  return (
    <div className={`flex items-start gap-3 border px-4 py-4 text-sm ${toneClassNameMap[tone]} ${className}`.trim()}>
      {getInlineMessageIcon(tone)}
      <span>{message}</span>
    </div>
  );
}

export default InlineMessage;
