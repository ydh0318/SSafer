import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BarChart3, Loader2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import { ROUTES } from '../../constants/routes';
import LatestResultCard from '../../features/projects/components/LatestResultCard';
import ProjectDeleteModal from '../../features/projects/components/ProjectDeleteModal';
import ProjectDetailHero from '../../features/projects/components/ProjectDetailHero';
import ProjectDetailTabs, { type ProjectDetailTab } from '../../features/projects/components/ProjectDetailTabs';
import ProjectScanTimeline from '../../features/projects/components/ProjectScanTimeline';
import ProjectSettingsPanel from '../../features/projects/components/ProjectSettingsPanel';
import QuickActionCard from '../../features/projects/components/QuickActionCard';
import useProjectAgentStatus from '../../features/projects/hooks/useProjectAgentStatus';
import useProjectDeleteFlow from '../../features/projects/hooks/useProjectDeleteFlow';
import useProjectDetailData from '../../features/projects/hooks/useProjectDetailData';
import useProjectScans from '../../features/projects/hooks/useProjectScans';
import ScanStatusBadge from '../../features/scans/components/ScanStatusBadge';
import ScanTypeBadge from '../../features/scans/components/ScanTypeBadge';
import { formatCompactDateTime, getScanModeLabel } from '../../features/scans/utils/scanPresentation';
import { useAuthStore } from '../../store/authStore';

function ProjectDetailPage() {
  const navigate = useNavigate();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const user = useAuthStore((state) => state.user);

  const [activeTab, setActiveTab] = useState<ProjectDetailTab>('recent');
  const isGuest = user?.role === 'GUEST';

  const { isProjectLoading, projectDetail, projectError } = useProjectDetailData(projectId);
  const { agentError, agentStatus, isAgentLoading, refreshAgentStatus } = useProjectAgentStatus({
    isGuest,
    projectId,
  });
  const {
    activeScans,
    completedScans,
    deleteScan,
    deletingScanIds,
    failedScans,
    isScanListLoading,
    latestScan,
    latestScanSummary,
    refreshScans,
    scanFilters,
    scanListError,
    scans,
    setScanFilters,
  } = useProjectScans(projectId);

  const {
    closeDeleteModal,
    confirmDelete,
    errorMessage: deleteProjectError,
    isDeleteModalOpen,
    isDeleting: isDeletingProject,
    openDeleteModal,
    targetProject,
  } = useProjectDeleteFlow({
    onDeleted: () => {
      navigate(ROUTES.projects, { replace: true });
    },
  });

  if (!projectId) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-neutral-600">프로젝트 ID가 없습니다.</p>
        <Link className="inline-flex bg-black px-4 py-2 text-sm font-bold text-white" to={ROUTES.projects}>
          프로젝트 목록으로 돌아가기
        </Link>
      </section>
    );
  }

  const agentIsOnline = agentStatus?.status === 'ONLINE';

  const handleStartNewScan = () => {
    navigate(ROUTES.projects, { state: { focusProjectId: projectId } });
  };

  const handleCompare = () => {
    navigate(ROUTES.history, { state: { projectId } });
  };

  return (
    <section className="space-y-8">
      <ProjectDetailHero
        activeScanCount={activeScans.length}
        canCompare={completedScans.length >= 2}
        canDelete={Boolean(projectDetail)}
        completedScanCount={completedScans.length}
        description={projectDetail?.description ?? null}
        failedScanCount={failedScans.length}
        isAgentLoading={isAgentLoading}
        isAgentOnline={agentIsOnline}
        isLoading={isProjectLoading}
        onCompare={handleCompare}
        onDelete={() => {
          if (projectDetail) {
            openDeleteModal({ id: projectId, name: projectDetail.name });
          }
        }}
        onStartScan={handleStartNewScan}
        projectId={projectId}
        projectName={projectDetail?.name ?? null}
      />

      {projectError ? <PageBanner message={projectError} tone="error" /> : null}

      <ProjectDetailTabs active={activeTab} onChange={setActiveTab} />

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 6 }}
          key={activeTab}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeTab === 'recent' ? (
            <div className="space-y-6">
              {activeScans.length > 0 ? (
                <section className="border border-sky-200 bg-sky-50/80 p-5 landing-card-radius">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                        <p className="text-sm font-black text-sky-950">진행 중인 스캔</p>
                      </div>
                      <p className="mt-1 text-xs text-sky-800">
                        아직 진행 중인 CLI 및 에이전트 스캔이 먼저 표시됩니다.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-sky-700 shadow-sm">
                      {activeScans.length}건 진행 중
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {activeScans.slice(0, 3).map((scan) => (
                      <Link
                        className="flex flex-col gap-3 border border-sky-100 bg-white px-4 py-3 transition hover:border-sky-300 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        key={scan.scanId}
                        state={{ projectId }}
                        to={ROUTES.scanDetail.replace(':scanId', String(scan.scanId))}
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="rounded-full bg-black px-2.5 py-1 font-mono text-xs font-black text-white">
                            #{scan.scanId}
                          </span>
                          <ScanStatusBadge status={scan.status} />
                          <ScanTypeBadge scanType={scan.scanType} />
                          <span className="text-xs font-bold text-neutral-500">
                            {getScanModeLabel(scan.scanMode, scan.source)}
                          </span>
                          <span className="text-xs text-neutral-400">
                            요청 {formatCompactDateTime(scan.requestedAt)}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-sky-700">
                          진행 화면 열기
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              <LatestResultCard
                isLoading={isScanListLoading && !latestScan}
                projectId={projectId}
                scan={latestScan}
                summary={latestScanSummary}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <QuickActionCard
                  description="이 프로젝트가 선택된 상태로 스캔 시작 화면으로 돌아갑니다."
                  icon={RotateCcw}
                  onClick={handleStartNewScan}
                  title="새 스캔 시작"
                />
                <QuickActionCard
                  description={
                    completedScans.length >= 2
                      ? '같은 프로젝트의 완료된 스캔 결과를 비교합니다.'
                      : '비교 기능을 사용하려면 완료된 스캔이 2개 이상 필요합니다.'
                  }
                  disabled={completedScans.length < 2}
                  icon={BarChart3}
                  onClick={handleCompare}
                  title="결과 비교"
                />
              </div>
            </div>
          ) : null}

          {activeTab === 'history' ? (
            <ProjectScanTimeline
              deletingScanIds={deletingScanIds}
              errorMessage={scanListError}
              filters={scanFilters}
              isLoading={isScanListLoading}
              onDeleteScan={(scanId) => void deleteScan(scanId)}
              onFilterChange={setScanFilters}
              onRefresh={() => void refreshScans()}
              projectId={projectId}
              scans={scans}
            />
          ) : null}

          {activeTab === 'settings' ? (
            <ProjectSettingsPanel
              agentErrorMessage={agentError}
              agentStatus={agentStatus}
              isAgentLoading={isAgentLoading}
              onDeleteProject={() => {
                if (projectDetail) {
                  openDeleteModal({ id: projectId, name: projectDetail.name });
                }
              }}
              onRefreshAgent={() => void refreshAgentStatus()}
              project={projectDetail}
              scanCount={scans.length}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>

      {isDeleteModalOpen && targetProject ? (
        <ProjectDeleteModal
          errorMessage={deleteProjectError}
          isDeleting={isDeletingProject}
          onClose={closeDeleteModal}
          onConfirm={() => void confirmDelete()}
          projectName={targetProject.name}
        />
      ) : null}
    </section>
  );
}

export default ProjectDetailPage;
