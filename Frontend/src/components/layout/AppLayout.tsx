import { LogOut, Shield } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { getScreenByPathname, SCREEN_SPECS } from '../../constants/apiSpecs';
import { ROUTES } from '../../constants/routes';
import { logoutCurrentUser } from '../../features/auth/api/member';
import { useAuthStore } from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentScreen = getScreenByPathname(location.pathname);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const projects = useProjectStore((state) => state.projects);
  const firstProjectId = projects[0]?.id;

  const handleLogout = async () => {
    try {
      await logoutCurrentUser();
    } finally {
      logout();
      navigate(ROUTES.root);
    }
  };

  const routeByScreen = {
    entry: ROUTES.root,
    projects: ROUTES.projects,
    projectDetail: firstProjectId
      ? ROUTES.projectDetail.replace(':projectId', firstProjectId)
      : ROUTES.projects,
    scanRequest: firstProjectId
      ? ROUTES.scanRequest.replace(':projectId', firstProjectId)
      : ROUTES.projects,
    scanProgress: ROUTES.scanProgress.replace(':scanId', 'scan-a36'),
    result: ROUTES.scanDetail.replace(':scanId', 'scan-a36'),
    findingDetail: ROUTES.findingDetail
      .replace(':scanId', 'scan-a36')
      .replace(':findingId', 'FND-0001'),
    history: ROUTES.history,
    monitor: firstProjectId
      ? ROUTES.monitor.replace(':projectId', firstProjectId)
      : ROUTES.projects,
    settings: ROUTES.settings,
  } as const;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-80 shrink-0 border-r border-slate-200 bg-white p-5 xl:block">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-black tracking-tight">SSAFER</p>
              <p className="text-xs font-medium text-slate-500">Security workspace</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            {SCREEN_SPECS.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-bold transition ${
                    item.id === currentScreen.id
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  key={item.id}
                  to={routeByScreen[item.id]}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs opacity-60">{item.order}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  {currentScreen.order} / {currentScreen.path}
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                  {currentScreen.label}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  {currentScreen.summary}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                  {isAuthenticated ? 'Logged in' : 'Guest mode'}
                </div>
                {isAuthenticated ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400"
                    onClick={() => void handleLogout()}
                    type="button"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto xl:hidden">
              {SCREEN_SPECS.map((item) => (
                <Link
                  className={`shrink-0 rounded-md px-3 py-2 text-xs font-bold ${
                    item.id === currentScreen.id
                      ? 'bg-slate-950 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                  key={item.id}
                  to={routeByScreen[item.id]}
                >
                  {item.order}
                </Link>
              ))}
            </div>
          </header>

          <main className="p-5 md:p-8">
            <Outlet />
          </main>
        </section>
      </div>
    </div>
  );
}

export default AppLayout;
