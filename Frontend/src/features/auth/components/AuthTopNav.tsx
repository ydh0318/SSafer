import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AppBrand from '../../../components/common/AppBrand';
import ThemeToggleButton from '../../../components/common/ThemeToggleButton';
import { ROUTES } from '../../../constants/routes';
import { useAuthStore } from '../../../store/authStore';
import { enterGuestMode } from '../api/guest';

function AuthTopNav() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
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
          name: 'Guest User',
          role: 'GUEST',
        },
      });

      navigate(ROUTES.root);
    } catch (error) {
      setGuestErrorMessage(
        error instanceof Error ? error.message : '게스트 모드 진입에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setIsGuestPending(false);
    }
  };

  return (
    <header className="site-header-shell theme-surface-header fixed inset-x-0 top-0 z-30 border-b border-black/10 bg-[#f4f4f4]/95 backdrop-blur">
      <div className="site-header-inner mx-auto flex h-20 max-w-[1500px] items-center justify-between px-4 sm:px-6 md:px-10">
        <AppBrand textClassName="hidden sm:block" titleClassName="text-xl font-black tracking-normal" to={ROUTES.root} />

        <nav className="site-header-nav flex items-center gap-3 text-sm font-bold uppercase tracking-[0.08em] sm:gap-6">
          <ThemeToggleButton />

          <button
            className="site-header-link inline-flex items-center gap-2 text-black transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isGuestPending}
            onClick={() => void handleGuestEntry()}
            type="button"
          >
            {isGuestPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            <span className="site-header-link-label hidden sm:inline">게스트 모드로 이용</span>
            <span className="site-header-link-label sm:hidden">게스트</span>
          </button>
        </nav>
      </div>

      {guestErrorMessage ? (
        <div className="mx-auto max-w-[1500px] px-4 pb-3 text-sm font-semibold text-rose-600 sm:px-6 md:px-10">
          {guestErrorMessage}
        </div>
      ) : null}
    </header>
  );
}

export default AuthTopNav;
