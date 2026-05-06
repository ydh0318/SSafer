import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import {
  SESSION_EXPIRED_MESSAGE,
  SESSION_EXPIRED_STORAGE_KEY,
  isTokenExpired,
} from '../../features/auth/utils/session';
import { useAuthStore } from '../../store/authStore';

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();

  if (isAuthenticated && !refreshToken && isTokenExpired(accessToken)) {
    logout();

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, SESSION_EXPIRED_MESSAGE);
    }

    return <Navigate replace state={{ from: location }} to={ROUTES.login} />;
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to={ROUTES.login} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
