type AuthMessageProps = {
  tone?: 'error' | 'success' | 'info';
  message: string;
};

function AuthMessage({ tone = 'info', message }: AuthMessageProps) {
  const className =
    tone === 'error' ? 'text-rose-600' : tone === 'success' ? 'text-emerald-600' : 'text-slate-500';

  return <p className={`text-sm font-medium ${className}`}>{message}</p>;
}

export default AuthMessage;
