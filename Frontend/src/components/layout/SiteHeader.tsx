import {
  BookOpen,
  FolderKanban,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  ScanSearch,
  Trophy,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { getCurrentUserProfile, logoutCurrentUser } from '../../features/auth/api/member';
import { hasStoredMemberSession, isStoredGuestSession } from '../../features/auth/utils/session';
import { useAuthStore } from '../../store/authStore';
import AppBrand from '../common/AppBrand';
import ThemeToggleButton from '../common/ThemeToggleButton';

type SiteHeaderProps = {
  showSessionBar?: boolean;
  variant?: 'default' | 'transparent';
};

function getProfileInitial(name?: string, email?: string, fallback = 'U') {
  const source = (name?.trim() || email?.trim() || fallback).charAt(0);
  return source.toUpperCase();
}

function SiteHeader({ showSessionBar = true, variant = 'default' }: SiteHeaderProps) {
  const isTransparent = variant === 'transparent';
  const location = useLocation();
  const navigate = useNavigate();
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const isMemberSession =
    Boolean(refreshToken) || user?.role === 'USER' || user?.role === 'ADMIN' || hasStoredMemberSession();
  const isGuestSession = user?.role === 'GUEST' || isStoredGuestSession();
  const profileInitial = getProfileInitial(user?.name, user?.email, isGuestSession ? 'G' : 'U');
  void showSessionBar;

  useEffect(() => {
    if (!isMemberSession || isGuestSession || user?.name) {
      return;
    }

    let isMounted = true;

    const loadHeaderProfile = async () => {
      try {
        const profile = await getCurrentUserProfile();

        if (!isMounted) {
          return;
        }

        setUser({
          id: profile.email,
          email: profile.email,
          name: profile.displayName,
          role: user?.role ?? 'USER',
        });
      } catch {
        // Header profile hydration should not block navigation or logout.
      }
    };

    void loadHeaderProfile();

    return () => {
      isMounted = false;
    };
  }, [isGuestSession, isMemberSession, setUser, user?.name, user?.role]);

  const handleLogout = async () => {
    try {
      if (isMemberSession && !isGuestSession) {
        await logoutCurrentUser();
      }
    } catch {
      // Clear local session even if the logout API fails.
    } finally {
      logout();
      navigate(ROUTES.root, { replace: true });
    }
  };

  const navItems = [
    {
      label: '프로젝트',
      to: ROUTES.projects,
      icon: FolderKanban,
      active:
        location.pathname === ROUTES.projects ||
        location.pathname.startsWith('/projects/') ||
        location.pathname.startsWith('/results/') ||
        location.pathname.startsWith('/scans/'),
    },
    {
      label: '대시보드',
      to: ROUTES.dashboard,
      icon: LayoutDashboard,
      active: location.pathname === ROUTES.dashboard,
    },
    {
      label: '히스토리',
      to: ROUTES.history,
      icon: History,
      active: location.pathname.startsWith('/history'),
      memberOnly: true,
    },
    {
      label: '가이드',
      to: ROUTES.guide,
      icon: BookOpen,
      active: location.pathname.startsWith('/guide'),
    },
    {
      label: '타이핑 게임',
      to: ROUTES.typingGame,
      icon: Trophy,
      active: location.pathname.startsWith('/typing-game'),
    },
  ].filter((item) => !('memberOnly' in item) || isMemberSession);

  const linkClass = (active: boolean) =>
    `site-header-link inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 font-bold tracking-wide transition lg:h-auto lg:w-auto lg:gap-2 lg:rounded-sm lg:px-4 lg:py-2 ${
      active
        ? isTransparent
          ? 'bg-white text-black'
          : 'bg-black text-white'
        : isTransparent
          ? 'text-white/85 hover:text-white'
          : 'text-neutral-600 hover:text-black'
    }`;

  const headerShellClass = isTransparent
    ? 'site-header-shell site-app-header-shell'
    : 'site-header-shell site-app-header-shell theme-surface-header border-b border-neutral-200 bg-[#FAFAFA]/95 backdrop-blur';

  return (
    <header className={headerShellClass}>
      <div className="site-header-inner mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <AppBrand
          className="shrink-0"
          linkClassName={isTransparent ? 'text-white' : 'text-black'}
          subtitleClassName={
            isTransparent
              ? 'block text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60'
              : undefined
          }
          textClassName="hidden lg:block"
          titleClassName={`text-lg font-black tracking-tight ${isTransparent ? 'text-white' : 'text-black'}`}
          to={ROUTES.landing}
        />

        <nav className="site-header-nav flex min-w-0 items-center justify-end gap-1.5 text-sm sm:gap-2 lg:gap-3">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link className={linkClass(item.active)} key={item.to} to={item.to}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="site-header-link-label hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}

          <Link className={linkClass(location.pathname.startsWith('/monitor'))} to={ROUTES.monitor}>
            <ScanSearch className="h-4 w-4 shrink-0" />
            <span className="site-header-link-label hidden lg:inline">모니터링</span>
          </Link>

          <ThemeToggleButton className={isTransparent ? 'text-white/85 hover:text-white' : ''} />

          {isMemberSession ? (
            <>
              <button
                aria-label="설정"
                className={`site-header-link inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black transition hover:opacity-85 ${
                  isTransparent ? 'bg-white text-black' : 'bg-black text-white'
                }`}
                onClick={() => navigate(ROUTES.settings)}
                type="button"
              >
                <span>{profileInitial}</span>
              </button>

              <button
                aria-label="로그아웃"
                className={`site-header-link inline-flex h-10 w-10 shrink-0 items-center justify-center p-0 transition ${
                  isTransparent ? 'text-white/85 hover:text-white' : 'text-neutral-600 hover:text-black'
                }`}
                onClick={() => void handleLogout()}
                type="button"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : isGuestSession ? (
            <>
              <button
                aria-label="게스트 설정"
                className={`site-header-link inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-black uppercase tracking-[0.14em] transition hover:opacity-85 ${
                  isTransparent ? 'bg-white text-black' : 'bg-black text-white'
                }`}
                onClick={() => navigate(ROUTES.settings)}
                type="button"
              >
                <span>{profileInitial}</span>
              </button>

              <button
                aria-label="게스트 로그아웃"
                className={`site-header-link inline-flex h-10 w-10 shrink-0 items-center justify-center p-0 transition ${
                  isTransparent ? 'text-white/85 hover:text-white' : 'text-neutral-600 hover:text-black'
                }`}
                onClick={() => void handleLogout()}
                type="button"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              className={`site-header-link inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 font-bold tracking-wide transition hover:opacity-70 lg:h-auto lg:w-auto lg:gap-2 lg:rounded-sm lg:px-4 lg:py-2 ${
                isTransparent ? 'text-white' : 'text-black'
              }`}
              onClick={() => navigate(ROUTES.welcome)}
              type="button"
            >
              <LogIn className="h-4 w-4 shrink-0 lg:hidden" />
              <span className="site-header-link-label hidden lg:inline">로그인</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
