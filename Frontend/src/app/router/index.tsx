import { BrowserRouter, Route, Routes } from 'react-router-dom';

import AppLayout from '../../components/layout/AppLayout';
import { ROUTES } from '../../constants/routes';
import EntryPage from '../../pages/auth/EntryPage';
import GuestContinuePage from '../../pages/auth/GuestContinuePage';
import WelcomePage from '../../pages/auth/WelcomePage';
import OAuthCallbackPage from '../../pages/auth/OAuthCallbackPage';
import DashboardPage from '../../pages/dashboard/DashboardPage';
import GuidePage from '../../pages/guide/GuidePage';
import HistoryPage from '../../pages/history/HistoryPage';
import LandingPage from '../../pages/home/LandingPage';
import MonitorPage from '../../pages/monitor/MonitorPage';
import NotFoundPage from '../../pages/NotFoundPage';
import ProjectDetailPage from '../../pages/projects/ProjectDetailPage';
import ProjectListPage from '../../pages/projects/ProjectListPage';
import FindingDetailPage from '../../pages/results/FindingDetailPage';
import ResultPage from '../../pages/results/ResultPage';
import ScanDetailPage from '../../pages/scans/ScanDetailPage';
import SettingsPage from '../../pages/settings/SettingsPage';
import TypingGamePage from '../../pages/typing/TypingGamePage';
import ProtectedRoute from './ProtectedRoute';
import PublicOnlyRoute from './PublicOnlyRoute';

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<WelcomePage />} path={ROUTES.root} />
        <Route element={<LandingPage />} path={ROUTES.landing} />
        <Route element={<WelcomePage />} path={ROUTES.welcome} />
        <Route element={<GuidePage />} path={ROUTES.guide} />
        <Route element={<TypingGamePage />} path={ROUTES.typingGame} />
        <Route element={<OAuthCallbackPage provider="GOOGLE" />} path={ROUTES.oauthGoogleCallback} />
        <Route element={<OAuthCallbackPage provider="GITHUB" />} path={ROUTES.oauthGithubCallback} />
        <Route element={<GuestContinuePage />} path={ROUTES.guestContinue} />

        <Route element={<PublicOnlyRoute />}>
          <Route element={<EntryPage />} path={ROUTES.login} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route element={<DashboardPage />} path={ROUTES.dashboard} />
            <Route element={<ProjectListPage />} path={ROUTES.projects} />
            <Route element={<ProjectDetailPage />} path={ROUTES.projectDetail} />
            <Route element={<ScanDetailPage />} path={ROUTES.scanDetail} />
            <Route element={<ResultPage />} path={ROUTES.resultDetail} />
            <Route element={<FindingDetailPage />} path={ROUTES.resultFindingDetail} />
            <Route element={<HistoryPage />} path={ROUTES.history} />
            <Route element={<MonitorPage />} path={ROUTES.monitor} />
            <Route element={<SettingsPage />} path={ROUTES.settings} />
          </Route>
        </Route>

        <Route element={<NotFoundPage />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
