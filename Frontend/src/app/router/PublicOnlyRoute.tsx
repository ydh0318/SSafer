import { Navigate, Outlet } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import {
  clearSessionWithMessage,
  hasStoredMemberSession,
  hasInvalidAccessToken,
  isTokenExpired,
} from '../../features/auth/utils/session';
import { useAuthStore } from '../../store/authStore';

function PublicOnlyRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isMemberSession =
    Boolean(refreshToken) || user?.role === 'USER' || user?.role === 'ADMIN' || hasStoredMemberSession();

  if (isAuthenticated && !refreshToken && (!accessToken || hasInvalidAccessToken(accessToken) || isTokenExpired(accessToken))) {
    clearSessionWithMessage(logout);
    return <Outlet />;
  }

  if (isMemberSession) {
    return <Navigate replace to={ROUTES.projects} />;
  }

  return <Outlet />;
}

export default PublicOnlyRoute;
