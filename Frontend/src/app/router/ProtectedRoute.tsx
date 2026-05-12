import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import {
  clearSessionWithMessage,
  hasInvalidAccessToken,
  isTokenExpired,
} from '../../features/auth/utils/session';
import { useAuthStore } from '../../store/authStore';

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();

  if (isAuthenticated && !refreshToken && (!accessToken || hasInvalidAccessToken(accessToken) || isTokenExpired(accessToken))) {
    clearSessionWithMessage(logout);
    return <Navigate replace state={{ from: location }} to={ROUTES.welcome} />;
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to={ROUTES.welcome} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
