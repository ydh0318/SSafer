import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import AppBrand from '../common/AppBrand';
import { ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../store/authStore';

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isMemberSession = Boolean(refreshToken) || user?.role === 'USER' || user?.role === 'ADMIN';
  const isGuestSession = isAuthenticated && !isMemberSession;

  const handleLoginEntry = () => {
    if (isGuestSession) {
      logout();
    }

    navigate(ROUTES.login);
  };

  return (
    <div className="min-h-screen bg-[#f5f2ea] text-[#111111]">
      <header className="border-b border-[#e7decd] bg-[#f8f5ee]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <AppBrand titleClassName="text-lg font-black text-[#111111]" to={ROUTES.projects} />
          <nav className="flex items-center gap-4 text-sm font-semibold text-[#5f564c]">
            <Link
              className={`rounded-full px-3 py-2 transition ${
                location.pathname === ROUTES.projects || location.pathname.startsWith('/projects/')
                  ? 'bg-[#111111] text-white'
                  : 'text-[#5f564c] hover:text-[#111111]'
              }`}
              to={ROUTES.projects}
            >
              프로젝트
            </Link>
            {isAuthenticated && isMemberSession ? (
              <button
                className="rounded-full border border-[#d5cbb7] px-4 py-2 transition hover:border-[#9f937f]"
                onClick={logout}
                type="button"
              >
                로그아웃
              </button>
            ) : (
              <button
                className="rounded-full border border-[#111111] px-4 py-2 text-[#111111] transition hover:bg-[#111111] hover:text-white"
                onClick={handleLoginEntry}
                type="button"
              >
                로그인
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
