import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AppBrand from '../../../components/common/AppBrand';
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
          name: '게스트 워크스페이스',
          role: 'GUEST',
        },
      });

      navigate(ROUTES.projects);
    } catch (error) {
      setGuestErrorMessage(error instanceof Error ? error.message : '게스트 입장에 실패했습니다.');
    } finally {
      setIsGuestPending(false);
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-black/10 bg-[#f4f4f4]/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-6 md:px-10">
        <AppBrand titleClassName="text-xl font-black tracking-normal" to={ROUTES.root} />

        <nav className="flex items-center gap-6 text-sm font-bold uppercase tracking-[0.08em]">
          {isAuthenticated ? (
            <Link className="text-black transition hover:opacity-70" to={ROUTES.projects}>
              {user?.role === 'GUEST' ? '게스트 홈' : '프로젝트'}
            </Link>
          ) : null}
          <button
            className="inline-flex items-center gap-2 text-black transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isGuestPending}
            onClick={() => void handleGuestEntry()}
            type="button"
          >
            {isGuestPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            게스트 입장
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
