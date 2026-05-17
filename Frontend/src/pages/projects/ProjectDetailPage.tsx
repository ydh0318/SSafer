import { ArrowRight, CheckCircle2, Loader2, ShieldAlert, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { getProjectAgentStatus } from '../../features/agents/api/agents';
import AgentStatusCard from '../../features/agents/components/AgentStatusCard';
import { useToast } from '../../features/feedback/useToast';
import { getProjectDetail } from '../../features/projects/api/projects';
import { getScanSummary } from '../../features/results/api/results';
import ProjectDeleteModal from '../../features/projects/components/ProjectDeleteModal';
import useProjectDeleteFlow from '../../features/projects/hooks/useProjectDeleteFlow';
import {
  createScanRequest,
  deleteScanHistory,
  getProjectScanOptions,
  getProjectScans,
  requestAgentScan,
  requestUploadScan,
} from '../../features/scans/api/scans';
import ProjectScanList from '../../features/scans/components/ProjectScanList';
import ScanRequestForm, { type ScanRequestMethod } from '../../features/scans/components/ScanRequestForm';
import { formatBooleanLabel, getScanModeLabel } from '../../features/scans/utils/scanPresentation';
import { getUploadScanToastFeedback, getUploadScanValidationToastMessage } from '../../features/scans/utils/uploadScanFeedback';
import { getScanUploadValidationIssue } from '../../features/scans/utils/uploadValidation';
import { useAuthStore } from '../../store/authStore';
import type { ProjectDetailResponseData } from '../../types/project';
import type {
  AgentStatusResponseData,
  CreateScanRequestPayload,
  ProjectScanListItemData,
  ProjectScanListQuery,
  ProjectScanOptionsData,
} from '../../types/scan';

const initialScanRequestForm: CreateScanRequestPayload = {
  projectName: '',
  source: 'CLI',
  scanType: 'PROJECT_FILE',
  scanName: '',
  targetPath: '',
  includeLogs: false,
};

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
  const [scanOptions, setScanOptions] = useState<ProjectScanOptionsData | null>(null);
  const [scans, setScans] = useState<ProjectScanListItemData[]>([]);
  const [scanListError, setScanListError] = useState<string | null>(null);
  const [scanListNotice, setScanListNotice] = useState<string | null>(null);
  const [isScanListLoading, setIsScanListLoading] = useState(true);
  const [deletingScanIds, setDeletingScanIds] = useState<number[]>([]);

  const [latestAgentScanHasFindings, setLatestAgentScanHasFindings] = useState(false);

  const [scanRequestForm, setScanRequestForm] = useState<CreateScanRequestPayload>(initialScanRequestForm);
  const [scanRequestMethod, setScanRequestMethod] = useState<ScanRequestMethod>('AGENT');
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const [scanRequestError, setScanRequestError] = useState<string | null>(null);
  const [isScanRequestSubmitting, setIsScanRequestSubmitting] = useState(false);
  const [lastCreatedScan, setLastCreatedScan] = useState<{ scanId: number } | null>(null);

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

  const latestCompletedAgentScanId =
    scans.find((scan) => scan.status === 'DONE' && scan.scanMode === 'AGENT')?.scanId ?? null;

  useEffect(() => {
    if (!latestCompletedAgentScanId) {
      setLatestAgentScanHasFindings(false);
      return;
    }

    let isMounted = true;

    getScanSummary(latestCompletedAgentScanId)
      .then((summary) => {
        if (isMounted) {
          setLatestAgentScanHasFindings(summary.totalFindings > 0);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLatestAgentScanHasFindings(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latestCompletedAgentScanId]);

  useEffect(() => {
    if (!scanListNotice) {
      return;
    }

    toast.success(scanListNotice, { durationMs: 2000 });
    setScanListNotice(null);
  }, [scanListNotice, toast]);

  useEffect(() => {
    if (!lastCreatedScan) {
      return;
    }

    toast.success(`스캔 #${lastCreatedScan.scanId} 생성이 완료되었습니다.`, { durationMs: 2000 });
  }, [lastCreatedScan, toast]);

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
        setScanRequestForm((current) => ({
          ...current,
          projectName: data.name,
        }));
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

    let isMounted = true;

    const loadScanOptions = async () => {
      try {
        const data = await getProjectScanOptions(projectId);

        if (!isMounted) {
          return;
        }

        setScanOptions(data);
        setScanRequestMethod(
          data.defaultScanMode === 'AGENT' && data.availableScanModes.includes('AGENT') ? 'AGENT' : 'UPLOAD',
        );
      } catch (error) {
        console.error('Failed to load scan options.', error);

        if (isMounted) {
          setScanOptions(null);
          setScanRequestMethod('UPLOAD');
        }
      }
    };

    void loadScanOptions();

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

      if (lastCreatedScan?.scanId === scanId) {
        setLastCreatedScan(null);
      }

      setScanListNotice(`스캔 #${scanId} 이력을 삭제했습니다.`);
      await handleRefreshScans();
    } catch (error) {
      setScanListError(error instanceof Error ? error.message : '스캔 이력 삭제에 실패했습니다.');
      setScanListNotice(null);
    } finally {
      setDeletingScanIds((current) => current.filter((value) => value !== scanId));
    }
  };

  const handleSubmitScanRequest = async () => {
    if (!projectDetail) {
      return;
    }

    if (scanRequestMethod === 'AGENT' && !scanOptions?.availableScanModes.includes('AGENT')) {
      setScanRequestError('현재 사용할 수 없는 점검 방식입니다.');
      return;
    }

    // AGENT 모드: targetPath 필수 검증
    if (scanRequestMethod === 'AGENT') {
      if (!scanRequestForm.targetPath?.trim()) {
        setScanRequestError('점검 대상 경로(targetPath)를 입력해 주세요.');
        return;
      }
    }

    if (scanRequestMethod === 'UPLOAD') {
      const validationIssue = getScanUploadValidationIssue(selectedUploadFiles);

      if (validationIssue) {
        toast.warning(getUploadScanValidationToastMessage(validationIssue) ?? '업로드 파일을 다시 확인해주세요.', {
          durationMs: 3000,
        });
        return;
      }
    }

    setIsScanRequestSubmitting(true);
    setScanRequestError(null);

    try {
      let scanId: number;

      if (scanRequestMethod === 'AGENT') {
        // Local Agent 기반 점검 요청 API
        const data = await requestAgentScan(projectId, {
          targetPath: scanRequestForm.targetPath!.trim(),
          scanType: scanRequestForm.scanType ?? 'PROJECT_FILE',
          scanName: scanRequestForm.scanName?.trim() || undefined,
          includeLogs: Boolean(scanRequestForm.includeLogs),
        });
        scanId = data.scanId;

        if (!data.notificationSent) {
          toast.warning('점검 요청은 생성됐지만 Agent 알림 전송에 실패했습니다. Agent가 다음 폴링 주기에 자동으로 작업을 수신합니다.', {
            durationMs: 5000,
          });
        }
      } else if (scanRequestMethod === 'UPLOAD' && selectedUploadFiles.length > 0) {
        const data = await requestUploadScan({
          projectName: projectDetail.name,
          scanName: scanRequestForm.scanName?.trim() || undefined,
          files: selectedUploadFiles,
        });
        scanId = data.scanId;
      } else {
        const data = await createScanRequest({
          projectName: projectDetail.name,
          source: scanRequestForm.source ?? 'CLI',
          scanName: scanRequestForm.scanName?.trim() || undefined,
          targetPath: scanRequestForm.targetPath?.trim() || undefined,
          includeLogs: Boolean(scanRequestForm.includeLogs),
        });
        scanId = data.scanId;
      }

      setLastCreatedScan({ scanId });
      setScanRequestForm({
        projectName: projectDetail.name,
        source: 'CLI',
        scanType: 'PROJECT_FILE',
        scanName: '',
        targetPath: '',
        includeLogs: false,
      });
      setSelectedUploadFiles([]);
      setScanRequestMethod('AGENT');

      await handleRefreshScans();
      navigate(ROUTES.scanDetail.replace(':scanId', String(scanId)), {
        state: { autoOpenedFromScanRequest: true, projectId },
      });
    } catch (error) {
      if (scanRequestMethod === 'UPLOAD') {
        const feedback = getUploadScanToastFeedback(error, 'project-detail');
        if (feedback.tone === 'warning') {
          toast.warning(feedback.message, { durationMs: 3000 });
        } else {
          toast.error(feedback.message, { durationMs: 3000 });
        }
        await handleRefreshScans();
        return;
      }

      setScanRequestError(error instanceof Error ? error.message : '스캔 요청 중 오류가 발생했습니다.');
    } finally {
      setIsScanRequestSubmitting(false);
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

  const gooseMood = activeScans.length > 0 ? 'working' : completedScans.length > 0 ? 'happy' : 'idle';

  return (
    <section className="space-y-6">

      {/* ── 히어로 ── */}
      <div className="relative overflow-hidden border border-neutral-200 bg-white">
        {/* 라임 강조 줄 */}
        <div className="h-1 w-full bg-[#D4FC64]" />

        <div className="px-8 pt-7 pb-0">
          {/* 상단 내비 */}
          <div className="flex items-center justify-between">
            <Link
              className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.24em] text-neutral-400 transition hover:text-black uppercase"
              to={ROUTES.projects}
            >
              <ArrowRight className="h-3 w-3 rotate-180" />
              Projects
            </Link>
            <span className="font-mono text-[10px] text-neutral-300">PROJECT DETAIL</span>
          </div>

          {/* 프로젝트 이름 + 거위 */}
          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="min-w-0 pb-7">
              {/* 상태 칩 */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-bold tracking-wider ${
                  isAgentLoading
                    ? 'border-neutral-200 bg-neutral-100 text-neutral-400'
                    : agentIsOnline
                    ? 'border-[#B8E830] bg-[#F0FFD0] text-[#4A7A00]'
                    : 'border-neutral-200 bg-neutral-100 text-neutral-500'
                }`}>
                  {isAgentLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : agentIsOnline ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  {isAgentLoading ? 'AGENT ...' : agentIsOnline ? 'AGENT ONLINE' : 'AGENT OFFLINE'}
                </span>
                {activeScans.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1 font-mono text-[10px] font-bold tracking-wider text-neutral-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    SCANNING {activeScans.length}
                  </span>
                )}
              </div>

              {/* 프로젝트명 */}
              <h1 className="text-4xl font-black leading-tight tracking-tight text-black md:text-5xl lg:text-6xl">
                {isProjectLoading ? (
                  <span className="text-neutral-300">불러오는 중...</span>
                ) : (
                  projectDetail?.name ?? '프로젝트'
                )}
              </h1>

              {/* 설명 */}
              {projectDetail?.description && (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500">
                  {projectDetail.description}
                </p>
              )}

              {/* 액션 버튼 */}
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 bg-black px-5 py-2.5 text-sm font-black text-white transition hover:bg-neutral-800"
                  onClick={() => document.getElementById('scan-request-section')?.scrollIntoView({ behavior: 'smooth' })}
                  type="button"
                >
                  스캔 시작하기
                  <ArrowRight className="h-4 w-4" />
                </button>
                {lastCreatedScan && (
                  <Link
                    className="inline-flex items-center gap-2 border border-neutral-200 px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
                    state={{ projectId }}
                    to={ROUTES.scanDetail.replace(':scanId', String(lastCreatedScan.scanId))}
                  >
                    최근 스캔 보기
                  </Link>
                )}
                {projectDetail && (
                  <button
                    className="inline-flex items-center gap-1.5 border border-neutral-200 px-5 py-2.5 text-sm font-bold text-neutral-400 transition hover:border-rose-300 hover:text-rose-500"
                    onClick={() => openDeleteModal({ id: projectId, name: projectDetail.name })}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </button>
                )}
              </div>
            </div>

            {/* 거위 */}
            <div className="shrink-0 self-end translate-y-1">
              <PixelGoose mood={gooseMood} size={110} />
            </div>
          </div>

          {/* 하단 스탯 바 */}
          <div className="grid grid-cols-3 border-t border-neutral-100">
            {/* 진행 중 */}
            <div className={`flex items-center gap-3 border-r border-neutral-100 px-5 py-4 transition-colors ${activeScans.length > 0 ? 'bg-sky-50' : ''}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${activeScans.length > 0 ? 'bg-sky-100 text-sky-500' : 'bg-neutral-100 text-neutral-300'}`}>
                <Loader2 className={`h-4 w-4 ${activeScans.length > 0 ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <p className="font-mono text-[9px] font-bold tracking-[0.2em] text-neutral-400 uppercase">진행 중</p>
                <p className={`text-xl font-black leading-tight ${activeScans.length > 0 ? 'text-sky-600' : 'text-neutral-200'}`}>
                  {activeScans.length}
                </p>
              </div>
            </div>

            {/* 완료 */}
            <div className={`flex items-center gap-3 border-r border-neutral-100 px-5 py-4 transition-colors ${completedScans.length > 0 ? 'bg-[#F4FFD9]' : ''}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${completedScans.length > 0 ? 'bg-[#E2F9A0] text-[#5A8A00]' : 'bg-neutral-100 text-neutral-300'}`}>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="font-mono text-[9px] font-bold tracking-[0.2em] text-neutral-400 uppercase">완료</p>
                <p className={`text-xl font-black leading-tight ${completedScans.length > 0 ? 'text-[#4A7A00]' : 'text-neutral-200'}`}>
                  {completedScans.length}
                </p>
              </div>
            </div>

            {/* 실패/취소 */}
            <div className={`flex items-center gap-3 px-5 py-4 transition-colors ${failedScans.length > 0 ? 'bg-rose-50' : ''}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${failedScans.length > 0 ? 'bg-rose-100 text-rose-500' : 'bg-neutral-100 text-neutral-300'}`}>
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <p className="font-mono text-[9px] font-bold tracking-[0.2em] text-neutral-400 uppercase">실패/취소</p>
                <p className={`text-xl font-black leading-tight ${failedScans.length > 0 ? 'text-rose-600' : 'text-neutral-200'}`}>
                  {failedScans.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {projectError && <PageBanner message={projectError} tone="error" />}

      {/* ── 스캔 이력 (가장 위 — 사용자가 최근 스캔 결과를 가장 먼저 확인) ── */}
      <ProjectScanList
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

      {/* ── Agent 상세 (스캔 이력 다음 — 현재 연결 상태 확인) ── */}
      <AgentStatusCard
        agentStatus={agentStatus}
        errorMessage={agentError}
        isLoading={isAgentLoading}
        patchApplyEnabled={agentIsOnline && latestAgentScanHasFindings}
        onRefresh={() => void handleRefreshAgentStatus()}
        onRequestApply={() => {
          const latestDoneScan = completedScans[0];
          if (latestDoneScan) {
            navigate(ROUTES.resultDetail.replace(':scanId', String(latestDoneScan.scanId)), { state: { projectId } });
          }
        }}
        onRequestScan={() => {
          setScanRequestMethod('AGENT');
          document.getElementById('scan-request-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* ── 새 스캔 요청 + 프로젝트 정보 (가장 아래로 이동) ── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">

        {/* 새 스캔 요청 (주요 액션) */}
        <div id="scan-request-section" className="border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-6 py-4">
            <p className="font-mono text-[10px] font-bold tracking-[0.28em] text-neutral-400 uppercase">New Scan</p>
            <h2 className="mt-1 text-lg font-black text-black">새 스캔 요청</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Agent, 파일 업로드 방식 중 하나를 골라 스캔을 시작합니다.</p>
          </div>
          <div className="px-6 py-5">
            <ScanRequestForm
              agentAvailable={scanOptions === null ? true : scanOptions.availableScanModes.includes('AGENT')}
              agentStatus={agentStatus}
              isAgentLoading={isAgentLoading}
              errorMessage={scanRequestError}
              isSubmitting={isScanRequestSubmitting}
              onChange={setScanRequestForm}
              onFileChange={setSelectedUploadFiles}
              onMethodChange={setScanRequestMethod}
              onSubmit={() => void handleSubmitScanRequest()}
              scanRequestMethod={scanRequestMethod}
              selectedFiles={selectedUploadFiles}
              value={scanRequestForm}
            />
          </div>
        </div>

        {/* 프로젝트 정보 사이드바 */}
        <div className="flex flex-col gap-4">
          <div className="border border-neutral-200 bg-white px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-[10px] font-bold tracking-[0.28em] text-neutral-400 uppercase">Project Info</p>
              <PixelGoose mood={activeScans.length > 0 ? 'working' : completedScans.length > 0 ? 'happy' : 'idle'} size={32} />
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
                <dt className="text-neutral-500">기본 스캔 방식</dt>
                <dd className="font-bold text-black">{projectDetail ? getScanModeLabel(projectDetail.defaultScanMode) : '-'}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
                <dt className="text-neutral-500">모니터링</dt>
                <dd className="font-bold text-black">{projectDetail ? formatBooleanLabel(projectDetail.monitorEnabled) : '-'}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
                <dt className="text-neutral-500">전체 스캔</dt>
                <dd className="font-bold text-black">{scans.length}회</dd>
              </div>
            </dl>
          </div>

          {/* 완료 스캔 바로가기 */}
          {completedScans.length > 0 && (
            <div className="border border-neutral-200 bg-white px-5 py-5">
              <p className="font-mono text-[10px] font-bold tracking-[0.28em] text-neutral-400 uppercase mb-3">최근 완료 스캔</p>
              <div className="space-y-2">
                {completedScans.slice(0, 3).map((scan) => (
                  <Link
                    key={scan.scanId}
                    to={ROUTES.resultDetail.replace(':scanId', String(scan.scanId))}
                    state={{ projectId }}
                    className="flex items-center justify-between rounded border border-neutral-100 px-3 py-2 text-sm transition hover:border-black hover:bg-neutral-50"
                  >
                    <span className="font-mono text-xs text-neutral-500">#{scan.scanId}</span>
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                      결과 보기 <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

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
