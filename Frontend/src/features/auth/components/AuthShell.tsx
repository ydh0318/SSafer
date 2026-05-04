import type { ReactNode } from 'react';

import AuthTopNav from './AuthTopNav';

type AuthShellProps = {
  left: ReactNode;
  right?: ReactNode;
  leftClassName?: string;
  frameClassName?: string;
  contentClassName?: string;
};

function AuthShell({
  left,
  right,
  leftClassName,
  frameClassName,
  contentClassName,
}: AuthShellProps) {
  const hasRightPanel = Boolean(right);
  const leftSlotClassName = hasRightPanel ? 'auth-login-slot' : 'auth-single-slot';

  return (
    <div className="h-screen overflow-hidden bg-[#f4f4f4] px-4 pt-20 text-black md:px-8">
      <AuthTopNav />
      <div
        className={`flex h-[calc(100vh-5rem)] justify-center overflow-hidden ${contentClassName ?? 'items-center'}`}
      >
        <div
          className={`${hasRightPanel ? 'auth-design-frame' : 'auth-design-frame auth-single-frame'} ${frameClassName ?? ''}`.trim()}
        >
          {hasRightPanel ? <div className="auth-divider" aria-hidden="true" /> : null}
          <section className={`${leftSlotClassName} ${leftClassName ?? ''}`.trim()}>{left}</section>
          {hasRightPanel ? <section className="auth-signup-slot">{right}</section> : null}
        </div>
      </div>
    </div>
  );
}

export default AuthShell;
