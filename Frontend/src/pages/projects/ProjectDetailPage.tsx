import { Activity, Bot, FolderOpen, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import MetricCard from '../../components/common/MetricCard';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import { getProjectAgentStatus } from '../../features/agents/api/agents';
import AgentStatusCard from '../../features/agents/components/AgentStatusCard';
import { getProjectDetail } from '../../features/projects/api/projects';
import {
  createScanRequest,
  getProjectScans,
  reportUploadedScanResult,
  uploadScanResultFile,
} from '../../features/scans/api/scans';
import ProjectScanList from '../../features/scans/components/ProjectScanList';
import ScanRequestForm, { type ScanRequestMethod } from '../../features/scans/components/ScanRequestForm';
import { formatBooleanLabel } from '../../features/scans/utils/scanPresentation';
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

  const [scanFilters, setScanFilters] = useState<ProjectScanListQuery>({ page: 0, size: 20, status: '', scanMode: '' });
  const [scans, setScans] = useState<ProjectScanListItemData[]>([]);
  const [scanListError, setScanListError] = useState<string | null>(null);
  const [isScanListLoading, setIsScanListLoading] = useState(true);

  const [scanRequestForm, setScanRequestForm] = useState<CreateScanRequestPayload>(initialScanRequestForm);
  const [scanRequestMethod, setScanRequestMethod] = useState<ScanRequestMethod>('AGENT');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [scanRequestError, setScanRequestError] = useState<string | null>(null);
  const [isScanRequestSubmitting, setIsScanRequestSubmitting] = useState(false);
  const [lastCreatedScan, setLastCreatedScan] = useState<CreateScanResponseData | null>(null);

  const activeScans = scans.filter((scan) =>
    ['REQUESTED', 'QUEUED', 'RUNNING', 'RAW_UPLOADED'].includes(scan.status),
  );
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
        setScanListError(error instanceof Error ? error.message : '프로젝트 스캔 목록을 불러오지 못했습니다.');
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
      setScanListError(error instanceof Error ? error.message : '프로젝트 스캔 목록을 불러오지 못했습니다.');
    } finally {
      setIsScanListLoading(false);
    }
  };

  const handleSubmitScanRequest = async () => {
    if (!projectDetail) {
      return;
    }

    if (scanRequestMethod === 'UPLOAD' && !selectedUploadFile) {
      setScanRequestError('업로드 방식으로 진행하려면 스캔 결과 JSON 파일을 선택해주세요.');
      return;
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
      setScanRequestError(error instanceof Error ? error.message : '스캔 요청을 등록하지 못했습니다.');
    } finally {
      setIsScanRequestSubmitting(false);
    }
  };

  if (!projectId) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-slate-600">프로젝트 ID가 필요합니다.</p>
        <Link className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white" to={ROUTES.projects}>
          프로젝트 목록으로 돌아가기
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-[#eadfcb] bg-[linear-gradient(135deg,#fffdf8_0%,#f6efe0_52%,#efe7d9_100%)] px-6 py-8 shadow-[0_24px_90px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#8b7f6a]">프로젝트 스캔</p>
            <h2 className="mt-4 text-4xl font-black leading-tight text-[#111111] md:text-5xl">
              {isProjectLoading ? '프로젝트 정보를 불러오는 중...' : projectDetail?.name ?? '프로젝트 상세'}
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5f564c]">
              {projectDetail?.description ??
                '이 페이지에서 스캔 요청 등록, 결과 파일 업로드, 최근 스캔 이력 확인을 한 번에 진행할 수 있습니다.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="inline-flex rounded-full border border-[#cbbda6] px-5 py-3 text-sm font-bold text-[#3f352b] transition hover:border-[#9f937f]"
                to={ROUTES.projects}
              >
                프로젝트 목록으로 이동
              </Link>
              {lastCreatedScan ? (
                <Link
                  className="inline-flex rounded-full bg-[#111111] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#262626]"
                  state={{ projectId }}
                  to={ROUTES.scanDetail.replace(':scanId', String(lastCreatedScan.scanId))}
                >
                  최근 등록 스캔 보기
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:w-[26rem] xl:grid-cols-1">
            <MetricCard
              helper="프로젝트 기본 스캔 방식입니다."
              label="기본 스캔 방식"
              tone="plain"
              value={projectDetail ? (projectDetail.defaultScanMode === 'AGENT' ? '로컬 에이전트' : '파일 업로드') : '-'}
            />
            <MetricCard
              helper="모니터링 사용 여부입니다."
              label="모니터링"
              tone="amber"
              value={projectDetail ? formatBooleanLabel(projectDetail.monitorEnabled) : '-'}
            />
            <MetricCard
              helper="현재 조회된 스캔 수입니다."
              label="스캔 수"
              tone="sky"
              value={scans.length}
            />
          </div>
        </div>
      </section>

      {projectError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {projectError}
        </div>
      ) : null}

      {lastCreatedScan ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          스캔 #{lastCreatedScan.scanId} 이(가) 등록되었습니다. 상태 페이지에서 진행 상황을 계속 확인할 수 있습니다.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          helper="현재 진행 중인 스캔 수입니다."
          label="진행 중"
          tone="sky"
          value={activeScans.length}
        />
        <MetricCard helper="완료된 스캔 수입니다." label="완료" tone="green" value={completedScans.length} />
        <MetricCard helper="실패 또는 취소된 스캔 수입니다." label="확인 필요" tone="red" value={failedScans.length} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionPanel
          description="로컬 에이전트 실행 또는 JSON 결과 파일 업로드 방식으로 스캔을 시작할 수 있습니다."
          eyebrow="스캔 시작"
          title="새 스캔 등록"
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

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="inline-flex rounded-2xl bg-slate-100 p-3 text-slate-900">
              <FolderOpen className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-black text-slate-950">프로젝트 기준 관리</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              프로젝트 기준으로 누적 스캔 이력을 확인하고 이후 상태와 결과 화면으로 이동할 수 있습니다.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="inline-flex rounded-2xl bg-slate-100 p-3 text-slate-900">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-black text-slate-950">에이전트 연결 확인</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              로컬 에이전트가 연결되어 있는지 상태 API 기준으로 확인할 수 있습니다.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="inline-flex rounded-2xl bg-slate-100 p-3 text-slate-900">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-black text-slate-950">진행 상태 확인</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              스캔 요청 직후 상태 페이지로 이동해 실제 진행 상황을 바로 확인할 수 있습니다.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="inline-flex rounded-2xl bg-slate-100 p-3 text-slate-900">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-black text-slate-950">결과 확인 흐름</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              각 스캔 이력에서 상태 화면과 결과 화면으로 바로 이동할 수 있습니다.
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
        errorMessage={scanListError}
        filters={scanFilters}
        isLoading={isScanListLoading}
        onFilterChange={setScanFilters}
        onRefresh={() => void handleRefreshScans()}
        projectId={projectId}
        scans={scans}
      />
    </section>
  );
}

export default ProjectDetailPage;
