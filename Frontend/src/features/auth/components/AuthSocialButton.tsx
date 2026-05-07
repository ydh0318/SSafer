import type { ReactNode } from 'react';

type AuthSocialButtonProps = {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
};

function AuthSocialButton({ icon, label, onClick, disabled = false }: AuthSocialButtonProps) {
  return (
    <button
      className="auth-social-text inline-flex items-center justify-start gap-2 bg-transparent px-0 text-black transition hover:opacity-70"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default AuthSocialButton;
