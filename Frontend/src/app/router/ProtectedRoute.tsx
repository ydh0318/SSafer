import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../store/authStore';

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to={ROUTES.login} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
