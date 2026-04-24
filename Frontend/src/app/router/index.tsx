import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { ROUTES } from '../../constants/routes';
import LoginPage from '../../pages/auth/LoginPage';
import NotFoundPage from '../../pages/NotFoundPage';
import ProjectDetailPage from '../../pages/projects/ProjectDetailPage';
import ProjectListPage from '../../pages/projects/ProjectListPage';
import ResultPage from '../../pages/results/ResultPage';
import ScanDetailPage from '../../pages/scans/ScanDetailPage';
import ProtectedRoute from './ProtectedRoute';
import PublicOnlyRoute from './PublicOnlyRoute';

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Navigate replace to={ROUTES.projects} />} path={ROUTES.root} />

        <Route element={<PublicOnlyRoute />}>
          <Route element={<LoginPage />} path={ROUTES.login} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route element={<ProjectListPage />} path={ROUTES.projects} />
            <Route element={<ProjectDetailPage />} path={ROUTES.projectDetail} />
            <Route element={<ScanDetailPage />} path={ROUTES.scanDetail} />
            <Route element={<ResultPage />} path={ROUTES.resultDetail} />
          </Route>
        </Route>

        <Route element={<NotFoundPage />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
