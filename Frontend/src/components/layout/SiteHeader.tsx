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
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { hasStoredMemberSession, isStoredGuestSession } from '../../features/auth/utils/session';
import { useAuthStore } from '../../store/authStore';
import AppBrand from '../common/AppBrand';
import ThemeToggleButton from '../common/ThemeToggleButton';

type SiteHeaderProps = {
  showSessionBar?: boolean;
};

function getProfileInitial(name?: string, email?: string) {
  const source = (name?.trim() || email?.trim() || 'U').charAt(0);
  return source.toUpperCase();
}

function SiteHeader({ showSessionBar = true }: SiteHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const profileInitial = getProfileInitial(user?.name, user?.email);
  const isMemberSession =
    Boolean(refreshToken) || user?.role === 'USER' || user?.role === 'ADMIN' || hasStoredMemberSession();
  const isGuestSession = user?.role === 'GUEST' || isStoredGuestSession();
  void showSessionBar;
  void isGuestSession;
  void isMemberSession;

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
      label: '사용 가이드',
      to: ROUTES.guide,
      icon: BookOpen,
      active: location.pathname.startsWith('/guide'),
    },
    {
      label: '타이핑',
      to: ROUTES.typingGame,
      icon: Trophy,
      active: location.pathname.startsWith('/typing-game'),
    },
  ].filter((item) => !('memberOnly' in item) || isMemberSession);

  const linkClass = (active: boolean) =>
    `site-header-link inline-flex h-10 w-10 items-center justify-center rounded-sm p-0 font-bold tracking-wide transition lg:h-auto lg:w-auto lg:gap-2 lg:px-4 lg:py-2 ${
      active ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
    }`;

  return (
    <header className="site-header-shell site-app-header-shell theme-surface-header border-b border-neutral-200 bg-[#f5f5f5]/95 backdrop-blur">
      <div className="site-header-inner mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <AppBrand
          textClassName="hidden lg:block"
          titleClassName="text-lg font-black tracking-tight text-black"
          to={ROUTES.root}
        />

        <nav className="site-header-nav flex flex-wrap items-center gap-2 text-sm lg:gap-3">
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

          <ThemeToggleButton />

          {isAuthenticated ? (
            <>
              <button
                aria-label="설정"
                className="site-header-link inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-black text-white transition hover:opacity-85"
                onClick={() => navigate(ROUTES.settings)}
                type="button"
              >
                <span>{profileInitial}</span>
              </button>

              <button
                aria-label="로그아웃"
                className="site-header-link inline-flex h-10 w-10 items-center justify-center p-0 text-neutral-600 transition hover:text-black"
                onClick={logout}
                type="button"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              className="site-header-link inline-flex h-10 w-10 items-center justify-center rounded-sm p-0 font-bold tracking-wide text-black transition hover:opacity-70 lg:h-auto lg:w-auto lg:gap-2 lg:px-4 lg:py-2"
              onClick={() => navigate(ROUTES.login)}
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
