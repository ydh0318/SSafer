import { Navigate, Outlet } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { isTokenExpired } from '../../features/auth/utils/session';
import { useAuthStore } from '../../store/authStore';

function PublicOnlyRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const logout = useAuthStore((state) => state.logout);

  if (isAuthenticated && !refreshToken && isTokenExpired(accessToken)) {
    logout();
    return <Outlet />;
  }

  if (isAuthenticated) {
    return <Navigate replace to={ROUTES.dashboard} />;
  }

  return <Outlet />;
}

export default PublicOnlyRoute;
