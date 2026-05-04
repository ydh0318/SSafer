import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AuthButtonProps = {
  isLoading?: boolean;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
} & ButtonHTMLAttributes<HTMLButtonElement>;

function AuthButton({
  children,
  className,
  disabled,
  icon,
  isLoading = false,
  variant = 'primary',
  ...buttonProps
}: AuthButtonProps) {
  const baseClassName =
    'auth-button inline-flex w-full items-center justify-center gap-2 px-4 uppercase transition disabled:cursor-not-allowed disabled:opacity-60';

  const variantClassName =
    variant === 'primary'
      ? 'bg-black text-white hover:bg-zinc-800'
      : variant === 'secondary'
        ? 'border border-slate-300 bg-white text-black hover:border-black'
        : 'bg-transparent text-slate-600 hover:text-black';

  return (
    <button
      className={`${baseClassName} ${variantClassName} ${className ?? ''}`}
      disabled={disabled || isLoading}
      {...buttonProps}
    >
      {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}
      <span>{children}</span>
    </button>
  );
}

export default AuthButton;
