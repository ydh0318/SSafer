import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../store/authStore';

function PublicOnlyRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate replace to={ROUTES.projects} />;
  }

  return <Outlet />;
}

export default PublicOnlyRoute;
