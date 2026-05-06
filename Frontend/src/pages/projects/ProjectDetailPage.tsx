import { Activity, ArrowRight, Bot, FolderOpen, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import MetricCard from '../../components/common/MetricCard';
import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import { getProjectAgentStatus } from '../../features/agents/api/agents';
import AgentStatusCard from '../../features/agents/components/AgentStatusCard';
import { getProjectDetail } from '../../features/projects/api/projects';
import {
  createScanRequest,
  deleteScanHistory,
  getProjectScans,
  reportUploadedScanResult,
  uploadScanResultFile,
} from '../../features/scans/api/scans';
import ProjectScanList from '../../features/scans/components/ProjectScanList';
import ScanRequestForm, { type ScanRequestMethod } from '../../features/scans/components/ScanRequestForm';
import { formatBooleanLabel, getScanModeLabel } from '../../features/scans/utils/scanPresentation';
import { validateScanUploadFile } from '../../features/scans/utils/uploadValidation';
import type { ProjectDetailResponseData } from '../../types/project';
import type {
  AgentStatusResponseData,
  CreateScanRequestPayload,
  CreateScanResponseData,
  ProjectScanListItemData,
  ProjectScanListQuery,
} from '../../types/scan';

const initialScanRequestForm: CreateScanRequestPayload = {
  projectName: '',
  source: 'CLI',
  scanName: '',
  targetPath: '',
  includeLogs: false,
};

function ProjectDetailPage() {
  const navigate = useNavigate();
  const { projectId = '' } = useParams<{ projectId: string }>();

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

  const [scanRequestForm, setScanRequestForm] = useState<CreateScanRequestPayload>(initialScanRequestForm);
  const [scanRequestMethod, setScanRequestMethod] = useState<ScanRequestMethod>('AGENT');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [scanRequestError, setScanRequestError] = useState<string | null>(null);
  const [isScanRequestSubmitting, setIsScanRequestSubmitting] = useState(false);
  const [lastCreatedScan, setLastCreatedScan] = useState<CreateScanResponseData | null>(null);

  const activeScans = scans.filter((scan) => ['REQUESTED', 'QUEUED', 'RUNNING', 'RAW_UPLOADED'].includes(scan.status));
  const completedScans = scans.filter((scan) => scan.status === 'DONE');
  const failedScans = scans.filter((scan) => scan.status === 'FAILED' || scan.status === 'CANCELED');

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
        if (!isMounted) {
          return;
        }

        setProjectError(error instanceof Error ? error.message : '프로젝트 상세 정보를 불러오지 못했습니다.');
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

    const loadAgentStatus = async () => {
      setIsAgentLoading(true);
      setAgentError(null);

      try {
        const data = await getProjectAgentStatus(projectId);

        if (!isMounted) {
          return;
        }

        setAgentStatus(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAgentStatus(null);
        setAgentError(error instanceof Error ? error.message : '로컬 에이전트 상태를 불러오지 못했습니다.');
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
  }, [projectId]);

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

        if (!isMounted) {
          return;
        }

        setScans(data.items);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setScans([]);
        setScanListError(error instanceof Error ? error.message : '스캔 목록을 불러오지 못했습니다.');
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
    if (!projectId) {
      return;
    }

    setIsAgentLoading(true);
    setAgentError(null);

    try {
      const data = await getProjectAgentStatus(projectId);
      setAgentStatus(data);
    } catch (error) {
      setAgentStatus(null);
      setAgentError(error instanceof Error ? error.message : '로컬 에이전트 상태를 불러오지 못했습니다.');
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

    const shouldDelete = window.confirm(`스캔 #${scanId} 이력을 삭제하시겠습니까?`);

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

      setScanListNotice(`스캔 #${scanId} 이력이 프로젝트 목록에서 삭제되었습니다.`);
      await handleRefreshScans();
    } catch (error) {
      setScanListError(error instanceof Error ? error.message : 'Failed to delete scan history.');
      setScanListNotice(null);
    } finally {
      setDeletingScanIds((current) => current.filter((value) => value !== scanId));
    }
  };

  const handleSubmitScanRequest = async () => {
    if (!projectDetail) {
      return;
    }

    if (scanRequestMethod === 'UPLOAD') {
      const validationError = validateScanUploadFile(selectedUploadFile);

      if (validationError) {
        setScanRequestError(validationError);
        return;
      }
    }

    setIsScanRequestSubmitting(true);
    setScanRequestError(null);

    try {
      const data = await createScanRequest({
        projectName: projectDetail.name,
        source: scanRequestForm.source ?? 'CLI',
        scanName: scanRequestForm.scanName?.trim() || undefined,
        targetPath: scanRequestForm.targetPath?.trim() || undefined,
        includeLogs: Boolean(scanRequestForm.includeLogs),
      });

      if (scanRequestMethod === 'UPLOAD' && selectedUploadFile) {
        await uploadScanResultFile(data.rawUploadUrl, selectedUploadFile);
        await reportUploadedScanResult(data.scanId, selectedUploadFile);
      }

      setLastCreatedScan(data);
      setScanRequestForm({
        projectName: projectDetail.name,
        source: 'CLI',
        scanName: '',
        targetPath: '',
        includeLogs: false,
      });
      setSelectedUploadFile(null);
      setScanRequestMethod('AGENT');

      await handleRefreshScans();
      navigate(ROUTES.scanDetail.replace(':scanId', String(data.scanId)), {
        state: { projectId, autoOpenedFromScanRequest: true },
      });
    } catch (error) {
      setScanRequestError(error instanceof Error ? error.message : '스캔 요청 등록에 실패했습니다.');
    } finally {
      setIsScanRequestSubmitting(false);
    }
  };

  if (!projectId) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-neutral-600">프로젝트 ID가 없습니다.</p>
        <Link className="inline-flex bg-black px-4 py-2 text-sm font-bold text-white" to={ROUTES.projects}>
          프로젝트 목록으로 이동
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <PageHero
        actions={
          <>
            <Link
              className="border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
              to={ROUTES.projects}
            >
              프로젝트 목록
            </Link>
            {lastCreatedScan ? (
              <Link
                className="inline-flex items-center gap-2 bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
                state={{ projectId }}
                to={ROUTES.scanDetail.replace(':scanId', String(lastCreatedScan.scanId))}
              >
                최신 스캔 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </>
        }
        aside={
          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">PROJECT STATUS</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-black">
                  {isProjectLoading ? '프로젝트 불러오는 중...' : projectDetail?.name ?? '프로젝트 정보 없음'}
                </h2>
              </div>
              <PixelGoose mood={activeScans.length > 0 ? 'working' : completedScans.length > 0 ? 'happy' : 'idle'} size={88} />
            </div>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              {projectDetail?.description ?? '프로젝트 설명이 아직 등록되지 않았습니다.'}
            </p>
          </div>
        }
        description={
          <>
            프로젝트 단위로 스캔 등록, 파일 업로드, 로컬 에이전트 상태 확인, 스캔 이력 확인을 모두 이 화면에서 이어서 처리합니다.
          </>
        }
        eyebrow="PROJECT DETAIL"
        title={
          <>
            스캔을 시작하고,
            <br />
            진행 이력을 프로젝트 안에서 관리합니다.
          </>
        }
      />

      {projectError ? <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{projectError}</div> : null}

      {!scanListError && scanListNotice ? (
        <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">{scanListNotice}</div>
      ) : null}

      {lastCreatedScan ? (
        <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          스캔 #{lastCreatedScan.scanId} 이(가) 등록되었습니다. 상태 화면으로 이동해 진행 상황을 확인할 수 있습니다.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard helper="현재 진행 중이거나 대기 중인 스캔 수입니다." label="진행 중 스캔" tone="sky" value={activeScans.length} />
        <MetricCard helper="완료된 스캔 수입니다." label="완료된 스캔" tone="green" value={completedScans.length} />
        <MetricCard helper="실패 또는 취소된 스캔 수입니다." label="주의 필요" tone="red" value={failedScans.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <SectionPanel
          description="로컬 에이전트 실행형 스캔과 JSON 업로드형 스캔을 같은 폼에서 처리합니다. 기존 API 호출 구조는 유지됩니다."
          eyebrow="NEW SCAN"
          title="새 스캔 요청"
        >
          <ScanRequestForm
            errorMessage={scanRequestError}
            isSubmitting={isScanRequestSubmitting}
            onChange={setScanRequestForm}
            onFileChange={setSelectedUploadFile}
            onMethodChange={setScanRequestMethod}
            onSubmit={() => void handleSubmitScanRequest()}
            scanRequestMethod={scanRequestMethod}
            selectedFile={selectedUploadFile}
            value={scanRequestForm}
          />
        </SectionPanel>

        <div className="grid gap-4">
          <article className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="inline-flex bg-black p-3 text-white">
              <FolderOpen className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-black tracking-tight text-black">프로젝트 기본 정보</h3>
            <dl className="mt-4 space-y-3 text-sm text-neutral-600">
              <div className="flex items-start justify-between gap-4 border-t border-neutral-100 pt-3">
                <dt className="font-semibold text-neutral-500">기본 스캔 방식</dt>
                <dd className="text-right font-bold text-black">
                  {projectDetail ? getScanModeLabel(projectDetail.defaultScanMode) : '-'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-neutral-100 pt-3">
                <dt className="font-semibold text-neutral-500">상태 추적</dt>
                <dd className="text-right font-bold text-black">
                  {projectDetail ? formatBooleanLabel(projectDetail.monitorEnabled) : '-'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-neutral-100 pt-3">
                <dt className="font-semibold text-neutral-500">누적 스캔 수</dt>
                <dd className="text-right font-bold text-black">{scans.length}</dd>
              </div>
            </dl>
          </article>

          <article className="border border-neutral-200 bg-black p-5 text-white shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#3ddc84]">WORKFLOW</p>
                <h3 className="mt-3 text-xl font-black tracking-tight">등록 후에는 상태 화면으로 바로 이어집니다.</h3>
                <p className="mt-3 text-sm leading-7 text-neutral-300">
                  스캔 등록에 성공하면 스캔 진행 상태 페이지로 이동하고, 그 화면에서 자동 새로고침으로 현재 단계를 계속 확인할 수 있습니다.
                </p>
              </div>
              <PixelGoose mood="working" size={72} />
            </div>
          </article>

          <article className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="inline-flex bg-black p-3 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-black tracking-tight text-black">업로드 전 확인할 점</h3>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              업로드 파일은 JSON 형식, 10MB 이하, 비어 있지 않은 파일만 허용됩니다. 오류가 있으면 요청 전에 프론트에서 먼저 알려줍니다.
            </p>
          </article>

          <article className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="inline-flex bg-black p-3 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-black tracking-tight text-black">에이전트 연결 상태</h3>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              아래 에이전트 상태 카드에서 온라인 여부와 최근 응답 시간을 확인한 뒤 로컬 에이전트 스캔을 요청하면 더 안정적으로 테스트할 수 있습니다.
            </p>
          </article>
        </div>
      </div>

      <AgentStatusCard
        agentStatus={agentStatus}
        errorMessage={agentError}
        isLoading={isAgentLoading}
        onRefresh={() => void handleRefreshAgentStatus()}
      />

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

      <article className="border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-black p-3 text-white">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight text-black">현재 구현 범위</h3>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              이 화면은 기존에 연결된 프로젝트 상세, 에이전트 상태, 스캔 목록, 스캔 요청 API를 그대로 사용하면서 사용자 관점에서 더 보기 쉽게 재배치한 버전입니다.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}

export default ProjectDetailPage;
