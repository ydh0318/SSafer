import { Link, Outlet } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../store/authStore';

function AppLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="min-h-screen bg-[#f5f2ea] text-[#111111]">
      <header className="border-b border-[#e7decd] bg-[#f8f5ee]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#8b7f6a]">SSAFER</p>
            <h1 className="text-lg font-black text-[#111111]">Security Workspace</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm font-semibold text-[#5f564c]">
            <Link className="transition hover:text-[#111111]" to={ROUTES.projects}>
              Dashboard
            </Link>
            <Link
              className="transition hover:text-[#111111]"
              to={ROUTES.resultDetail.replace(':scanId', 'scan-a36')}
            >
              Recent Results
            </Link>
            {isAuthenticated ? (
              <button
                className="rounded-full border border-[#d5cbb7] px-4 py-2 transition hover:border-[#9f937f]"
                onClick={logout}
                type="button"
              >
                Logout
              </button>
            ) : (
              <Link
                className="rounded-full border border-[#111111] px-4 py-2 text-[#111111] transition hover:bg-[#111111] hover:text-white"
                to={ROUTES.login}
              >
                Login
              </Link>
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
