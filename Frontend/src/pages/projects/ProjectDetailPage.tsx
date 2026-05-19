import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import { ROUTES } from '../../constants/routes';
import { getProjectAgentStatus } from '../../features/agents/api/agents';
import { useToast } from '../../features/feedback/useToast';
import { getProjectDetail } from '../../features/projects/api/projects';
import LatestResultCard from '../../features/projects/components/LatestResultCard';
import ProjectDeleteModal from '../../features/projects/components/ProjectDeleteModal';
import ProjectDetailHero from '../../features/projects/components/ProjectDetailHero';
import ProjectDetailTabs, { type ProjectDetailTab } from '../../features/projects/components/ProjectDetailTabs';
import ProjectScanTimeline from '../../features/projects/components/ProjectScanTimeline';
import ProjectSettingsPanel from '../../features/projects/components/ProjectSettingsPanel';
import QuickActionCard from '../../features/projects/components/QuickActionCard';
import useProjectDeleteFlow from '../../features/projects/hooks/useProjectDeleteFlow';
import { getScanSummary } from '../../features/results/api/results';
import {
  deleteScanHistory,
  getProjectScans,
} from '../../features/scans/api/scans';
import { useAuthStore } from '../../store/authStore';
import type { ProjectDetailResponseData } from '../../types/project';
import type {
  AgentStatusResponseData,
  ProjectScanListItemData,
  ProjectScanListQuery,
  ScanSummaryData,
} from '../../types/scan';

function ProjectDetailPage() {
  const navigate = useNavigate();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);

  const [projectDetail, setProjectDetail] = useState<ProjectDetailResponseData | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);

  const [agentStatus, setAgentStatus] = useState<AgentStatusResponseData | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [isAgentLoading, setIsAgentLoading] = useState(true);

  const [scanFilters, setScanFilters] = useState<ProjectScanListQuery>({
    page: 0,
    size: 20,
    status: '',
    scanMode: '',
  });
  const [scans, setScans] = useState<ProjectScanListItemData[]>([]);
  const [scanListError, setScanListError] = useState<string | null>(null);
  const [scanListNotice, setScanListNotice] = useState<string | null>(null);
  const [isScanListLoading, setIsScanListLoading] = useState(true);
  const [deletingScanIds, setDeletingScanIds] = useState<number[]>([]);

  const [activeTab, setActiveTab] = useState<ProjectDetailTab>('recent');
  const [latestScanSummary, setLatestScanSummary] = useState<ScanSummaryData | null>(null);

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

  const activeScans = scans.filter((scan) => ['REQUESTED', 'QUEUED', 'RUNNING', 'RAW_UPLOADED'].includes(scan.status));
  const completedScans = scans.filter((scan) => scan.status === 'DONE');
  const failedScans = scans.filter((scan) => scan.status === 'FAILED' || scan.status === 'CANCELED');

  const latestCompletedScanId = completedScans[0]?.scanId ?? null;

  useEffect(() => {
    if (!latestCompletedScanId) {
      setLatestScanSummary(null);
      return;
    }

    let isMounted = true;

    getScanSummary(latestCompletedScanId)
      .then((summary) => {
        if (isMounted) {
          setLatestScanSummary(summary);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLatestScanSummary(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latestCompletedScanId]);

  useEffect(() => {
    if (!scanListNotice) {
      return;
    }

    toast.success(scanListNotice, { durationMs: 2000 });
    setScanListNotice(null);
  }, [scanListNotice, toast]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let isMounted = true;

    const loadProject = async () => {
      setIsProjectLoading(true);
      setProjectError(null);

      try {
        const data = await getProjectDetail(projectId);

        if (!isMounted) {
          return;
        }

        setProjectDetail(data);
      } catch (error) {
        if (isMounted) {
          setProjectError(error instanceof Error ? error.message : '프로젝트 상세 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsProjectLoading(false);
        }
      }
    };

    void loadProject();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    if (user?.role === 'GUEST') {
      setAgentStatus(null);
      setAgentError(null);
      setIsAgentLoading(false);
      return;
    }

    let isMounted = true;

    const loadAgentStatus = async () => {
      setIsAgentLoading(true);
      setAgentError(null);

      try {
        const data = await getProjectAgentStatus(projectId);

        if (isMounted) {
          setAgentStatus(data);
        }
      } catch (error) {
        if (isMounted) {
          setAgentStatus(null);
          setAgentError(error instanceof Error ? error.message : '에이전트 상태를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsAgentLoading(false);
        }
      }
    };

    void loadAgentStatus();

    return () => {
      isMounted = false;
    };
  }, [projectId, user?.role]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let isMounted = true;

    const loadScans = async () => {
      setIsScanListLoading(true);
      setScanListError(null);

      try {
        const data = await getProjectScans(projectId, scanFilters);

        if (isMounted) {
          setScans(data.items);
        }
      } catch (error) {
        if (isMounted) {
          setScans([]);
          setScanListError(error instanceof Error ? error.message : '스캔 목록을 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsScanListLoading(false);
        }
      }
    };

    void loadScans();

    return () => {
      isMounted = false;
    };
  }, [projectId, scanFilters]);

  const handleRefreshAgentStatus = async () => {
    if (!projectId || user?.role === 'GUEST') {
      setAgentStatus(null);
      setAgentError(null);
      setIsAgentLoading(false);
      return;
    }

    setIsAgentLoading(true);
    setAgentError(null);

    try {
      const data = await getProjectAgentStatus(projectId);
      setAgentStatus(data);
    } catch (error) {
      setAgentStatus(null);
      setAgentError(error instanceof Error ? error.message : '에이전트 상태를 불러오지 못했습니다.');
    } finally {
      setIsAgentLoading(false);
    }
  };

  const handleRefreshScans = async () => {
    if (!projectId) {
      return;
    }

    setIsScanListLoading(true);
    setScanListError(null);

    try {
      const data = await getProjectScans(projectId, scanFilters);
      setScans(data.items);
    } catch (error) {
      setScans([]);
      setScanListError(error instanceof Error ? error.message : '스캔 목록을 불러오지 못했습니다.');
    } finally {
      setIsScanListLoading(false);
    }
  };

  const handleDeleteScan = async (scanId: number) => {
    if (!projectId) {
      return;
    }

    const shouldDelete = window.confirm(`스캔 #${scanId} 이력을 삭제할까요?`);

    if (!shouldDelete) {
      return;
    }

    setDeletingScanIds((current) => [...current, scanId]);
    setScanListError(null);
    setScanListNotice(null);

    try {
      await deleteScanHistory(scanId);

      setScanListNotice(`스캔 #${scanId} 이력을 삭제했습니다.`);
      await handleRefreshScans();
    } catch (error) {
      setScanListError(error instanceof Error ? error.message : '스캔 이력 삭제에 실패했습니다.');
      setScanListNotice(null);
    } finally {
      setDeletingScanIds((current) => current.filter((value) => value !== scanId));
    }
  };

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
  const latestScan = completedScans[0] ?? null;

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
              <LatestResultCard
                isLoading={isScanListLoading && !latestScan}
                projectId={projectId}
                scan={latestScan}
                summary={latestScanSummary}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <QuickActionCard
                  description="같은 프로젝트로 새 스캔을 한 번 더 돌려서 변경사항을 확인해 보세요."
                  icon={RotateCcw}
                  onClick={handleStartNewScan}
                  title="다시 스캔"
                />
                <QuickActionCard
                  description={
                    completedScans.length >= 2
                      ? '히스토리에서 두 스캔을 골라 신규·해결됨·심각도 변경을 확인합니다.'
                      : '완료된 스캔이 2개 이상 쌓이면 비교할 수 있어요.'
                  }
                  disabled={completedScans.length < 2}
                  icon={BarChart3}
                  onClick={handleCompare}
                  title="이전 결과와 비교"
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
              onDeleteScan={(scanId) => void handleDeleteScan(scanId)}
              onFilterChange={setScanFilters}
              onRefresh={() => void handleRefreshScans()}
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
              onRefreshAgent={() => void handleRefreshAgentStatus()}
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
