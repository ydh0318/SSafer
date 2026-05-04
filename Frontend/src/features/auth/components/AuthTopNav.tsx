import { LoaderCircle, Shield } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ROUTES } from '../../../constants/routes';
import { useAuthStore } from '../../../store/authStore';
import { enterGuestMode } from '../api/guest';

function AuthTopNav() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [isGuestPending, setIsGuestPending] = useState(false);
  const [guestErrorMessage, setGuestErrorMessage] = useState<string | null>(null);

  const handleGuestEntry = async () => {
    setIsGuestPending(true);
    setGuestErrorMessage(null);

    try {
      const session = await enterGuestMode();

      login({
        accessToken: session.guestAccessToken,
        refreshToken: null,
        user: {
          id: `guest:${session.expiresAt}`,
          email: 'guest@ssafer.local',
          name: 'Guest Workspace',
          role: 'GUEST',
        },
      });

      navigate(ROUTES.projects);
    } catch (error) {
      setGuestErrorMessage(
        error instanceof Error ? error.message : '게스트 모드로 진입하지 못했습니다.',
      );
    } finally {
      setIsGuestPending(false);
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-black/10 bg-[#f4f4f4]/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-6 md:px-10">
        <Link className="inline-flex items-center gap-3 text-black" to={ROUTES.root}>
          <span className="grid h-10 w-10 place-items-center bg-black text-white">
            <Shield className="h-5 w-5" />
          </span>
          <span className="text-xl font-black tracking-normal">SSAFER.io</span>
        </Link>

        <nav className="flex items-center gap-6 text-sm font-bold uppercase tracking-[0.08em]">
          {isAuthenticated ? (
            <Link className="text-black transition hover:opacity-70" to={ROUTES.projects}>
              {user?.role === 'GUEST' ? 'Guest Main' : 'Main'}
            </Link>
          ) : null}
          <button
            className="inline-flex items-center gap-2 text-black transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isGuestPending}
            onClick={() => void handleGuestEntry()}
            type="button"
          >
            {isGuestPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Guest
          </button>
        </nav>
      </div>

      {guestErrorMessage ? (
        <div className="mx-auto max-w-[1500px] px-6 pb-3 text-sm font-semibold text-rose-600 md:px-10">
          {guestErrorMessage}
        </div>
      ) : null}
    </header>
  );
}

export default AuthTopNav;
