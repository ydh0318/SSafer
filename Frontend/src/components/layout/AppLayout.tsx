import { Link, Outlet } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../store/authStore';

function AppLayout() {
  const { isAuthenticated, logout } = useAuthStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    logout: state.logout,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">SSAFER</p>
            <h1 className="text-lg font-semibold">Frontend Workspace</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <Link className="transition hover:text-white" to={ROUTES.projects}>
              Projects
            </Link>
            <Link
              className="transition hover:text-white"
              to={ROUTES.resultDetail.replace(':scanId', '1')}
            >
              Results
            </Link>
            {isAuthenticated ? (
              <button
                className="rounded-md border border-slate-700 px-3 py-1.5 transition hover:border-slate-500"
                onClick={logout}
                type="button"
              >
                Logout
              </button>
            ) : (
              <Link
                className="rounded-md border border-cyan-500 px-3 py-1.5 text-cyan-300 transition hover:bg-cyan-500/10"
                to={ROUTES.login}
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
