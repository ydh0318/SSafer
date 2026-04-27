import { BrowserRouter, Route, Routes } from 'react-router-dom';

import AppLayout from '../../components/layout/AppLayout';
import { ROUTES } from '../../constants/routes';
import EntryPage from '../../pages/auth/EntryPage';
import LoginPage from '../../pages/auth/LoginPage';
import HistoryPage from '../../pages/history/HistoryPage';
import MonitorPage from '../../pages/monitor/MonitorPage';
import NotFoundPage from '../../pages/NotFoundPage';
import ProjectDetailPage from '../../pages/projects/ProjectDetailPage';
import ProjectListPage from '../../pages/projects/ProjectListPage';
import FindingDetailPage from '../../pages/results/FindingDetailPage';
import ResultPage from '../../pages/results/ResultPage';
import ScanProgressPage from '../../pages/scans/ScanProgressPage';
import ScanRequestPage from '../../pages/scans/ScanRequestPage';
import SettingsPage from '../../pages/settings/SettingsPage';

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route element={<EntryPage />} path={ROUTES.root} />
          <Route element={<LoginPage />} path={ROUTES.login} />
          <Route element={<ProjectListPage />} path={ROUTES.projects} />
          <Route element={<ProjectDetailPage />} path={ROUTES.projectDetail} />
          <Route element={<ScanRequestPage />} path={ROUTES.scanRequest} />
          <Route element={<ScanProgressPage />} path={ROUTES.scanProgress} />
          <Route element={<ResultPage />} path={ROUTES.scanDetail} />
          <Route element={<FindingDetailPage />} path={ROUTES.findingDetail} />
          <Route element={<HistoryPage />} path={ROUTES.history} />
          <Route element={<MonitorPage />} path={ROUTES.monitor} />
          <Route element={<SettingsPage />} path={ROUTES.settings} />
        </Route>

        <Route element={<NotFoundPage />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
