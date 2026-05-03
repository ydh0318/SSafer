import type { InputHTMLAttributes, ReactNode } from 'react';

type AuthFieldProps = {
  label: string;
  errorMessage?: string;
  helperText?: string;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

function AuthField({
  label,
  errorMessage,
  helperText,
  trailing,
  className,
  ...inputProps
}: AuthFieldProps) {
  return (
    <label className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="auth-label text-black">
          {label}
        </span>
        {trailing}
      </div>
      <input
        className={`auth-input w-full px-[3.54%] text-black outline-none transition placeholder:text-[#afafaf] focus:border-black ${
          errorMessage ? 'border-rose-500' : 'border-slate-200'
        } ${className ?? ''}`}
        {...inputProps}
      />
      {errorMessage ? (
        <span className="text-sm font-medium text-rose-600">{errorMessage}</span>
      ) : helperText ? (
        <span className="text-sm text-slate-500">{helperText}</span>
      ) : null}
    </label>
  );
}

export default AuthField;
