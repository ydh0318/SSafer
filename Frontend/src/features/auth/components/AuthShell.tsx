import type { ReactNode } from 'react';

import AuthTopNav from './AuthTopNav';

type AuthShellProps = {
  left: ReactNode;
  right?: ReactNode;
};

function AuthShell({ left, right }: AuthShellProps) {
  const hasRightPanel = Boolean(right);

  return (
    <div className="h-screen overflow-hidden bg-[#f4f4f4] px-4 pt-20 text-black md:px-8">
      <AuthTopNav />
      <div className="flex h-[calc(100vh-5rem)] items-center justify-center overflow-hidden">
        <div className={hasRightPanel ? 'auth-design-frame' : 'auth-design-frame auth-single-frame'}>
          {hasRightPanel ? <div className="auth-divider" aria-hidden="true" /> : null}
          <section className={hasRightPanel ? 'auth-login-slot' : 'auth-single-slot'}>{left}</section>
          {hasRightPanel ? <section className="auth-signup-slot">{right}</section> : null}
        </div>
      </div>
    </div>
  );
}

export default AuthShell;
