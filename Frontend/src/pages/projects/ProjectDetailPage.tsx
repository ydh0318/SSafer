import { Activity, ArrowRight, Bot, FolderOpen, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import MetricCard from '../../components/common/MetricCard';
import PageBanner from '../../components/common/PageBanner';
import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import { getProjectAgentStatus } from '../../features/agents/api/agents';
import AgentStatusCard from '../../features/agents/components/AgentStatusCard';
import { useToast } from '../../features/feedback/useToast';
import { getProjectDetail } from '../../features/projects/api/projects';
import ProjectDeleteModal from '../../features/projects/components/ProjectDeleteModal';
import useProjectDeleteFlow from '../../features/projects/hooks/useProjectDeleteFlow';
import {
  createScanRequest,
  deleteScanHistory,
  getProjectScanOptions,
  getProjectScans,
  requestUploadScan,
} from '../../features/scans/api/scans';
import ProjectScanList from '../../features/scans/components/ProjectScanList';
import ScanRequestForm, { type ScanRequestMethod } from '../../features/scans/components/ScanRequestForm';
import { formatBooleanLabel, getScanModeLabel } from '../../features/scans/utils/scanPresentation';
import { validateScanUploadFiles } from '../../features/scans/utils/uploadValidation';
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
  scanName: '',
  targetPath: '',
  includeLogs: false,
};

function ProjectDetailPage() {
  const navigate = useNavigate();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const toast = useToast();

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

    toast.success(`?ㅼ틪 #${lastCreatedScan.scanId} ?앹꽦???꾨즺?섏뿀?듬땲??`, { durationMs: 2000 });
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
          setProjectError(error instanceof Error ? error.message : '?꾨줈?앺듃 ?곸꽭 ?뺣낫瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??');
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
          setAgentError(error instanceof Error ? error.message : 'Agent ?곹깭瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??');
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

        if (isMounted) {
          setScans(data.items);
        }
      } catch (error) {
        if (isMounted) {
          setScans([]);
          setScanListError(error instanceof Error ? error.message : '?ㅼ틪 紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??');
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
      setAgentError(error instanceof Error ? error.message : 'Agent ?곹깭瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??');
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
      setScanListError(error instanceof Error ? error.message : '?ㅼ틪 紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??');
    } finally {
      setIsScanListLoading(false);
    }
  };

  const handleDeleteScan = async (scanId: number) => {
    if (!projectId) {
      return;
    }

    const shouldDelete = window.confirm(`?ㅼ틪 #${scanId} ??瑜? ??젣?좉퉴??`);

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

      setScanListNotice(`?ㅼ틪 #${scanId} ??媛) ??젣?섏뿀?듬땲??`);
      await handleRefreshScans();
    } catch (error) {
      setScanListError(error instanceof Error ? error.message : '?ㅼ틪 ??젣???ㅽ뙣?덉뒿?덈떎.');
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
      setScanRequestError('?꾩옱 ?ъ슜?????녿뒗 ?먭? 諛⑹떇?낅땲??');
      return;
    }

    if (scanRequestMethod === 'UPLOAD') {
      const validationError = validateScanUploadFiles(selectedUploadFiles);

      if (validationError) {
        setScanRequestError(validationError);
        return;
      }
    }

    setIsScanRequestSubmitting(true);
    setScanRequestError(null);

    try {
      const data =
        scanRequestMethod === 'UPLOAD' && selectedUploadFiles.length > 0
          ? await requestUploadScan({
              projectName: projectDetail.name,
              scanName: scanRequestForm.scanName?.trim() || undefined,
              files: selectedUploadFiles,
            })
          : await createScanRequest({
              projectName: projectDetail.name,
              source: scanRequestForm.source ?? 'CLI',
              scanName: scanRequestForm.scanName?.trim() || undefined,
              targetPath: scanRequestForm.targetPath?.trim() || undefined,
              includeLogs: Boolean(scanRequestForm.includeLogs),
            });

      setLastCreatedScan({ scanId: data.scanId });
      setScanRequestForm({
        projectName: projectDetail.name,
        source: 'CLI',
        scanName: '',
        targetPath: '',
        includeLogs: false,
      });
      setSelectedUploadFiles([]);
      setScanRequestMethod('AGENT');

      await handleRefreshScans();
      navigate(ROUTES.scanDetail.replace(':scanId', String(data.scanId)), {
        state: { autoOpenedFromScanRequest: true, projectId },
      });
    } catch (error) {
      setScanRequestError(error instanceof Error ? error.message : '?ㅼ틪 ?붿껌 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
    } finally {
      setIsScanRequestSubmitting(false);
    }
  };

  if (!projectId) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-neutral-600">?꾨줈?앺듃 ID媛 ?놁뒿?덈떎.</p>
        <Link className="inline-flex bg-black px-4 py-2 text-sm font-bold text-white" to={ROUTES.projects}>
          ?꾨줈?앺듃 紐⑸줉?쇰줈 ?뚯븘媛湲?        </Link>
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
              ?꾨줈?앺듃 紐⑸줉
            </Link>
            {projectDetail ? (
              <button
                className="inline-flex items-center gap-2 border border-rose-200 px-5 py-3 text-sm font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                onClick={() => openDeleteModal({ id: projectId, name: projectDetail.name })}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
                ?꾨줈?앺듃 ??젣
              </button>
            ) : null}
            {lastCreatedScan ? (
              <Link
                className="inline-flex items-center gap-2 bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
                state={{ projectId }}
                to={ROUTES.scanDetail.replace(':scanId', String(lastCreatedScan.scanId))}
              >
                理쒓렐 ?ㅼ틪 蹂닿린
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
                  {isProjectLoading ? '프로젝트 정보를 불러오는 중입니다.' : projectDetail?.name ?? '프로젝트 정보를 찾을 수 없습니다.'}
                </h2>
              </div>
              <PixelGoose mood={activeScans.length > 0 ? 'working' : completedScans.length > 0 ? 'happy' : 'idle'} size={88} />
            </div>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              {projectDetail?.description ?? '?꾨줈?앺듃 ?ㅻ챸???꾩쭅 ?놁뒿?덈떎.'}
            </p>
          </div>
        }
        description={
          <>
            ?꾨줈?앺듃 ?⑥쐞濡??ㅼ틪 ?붿껌, Agent ?곹깭, ?낅줈???먮쫫, ?ㅼ틪 湲곕줉?????붾㈃?먯꽌 愿由ы븷 ???덉뒿?덈떎.
          </>
        }
        eyebrow="PROJECT DETAIL"
        title={
          <>
            ?ㅼ틪???ㅽ뻾?섍퀬,
            <br />
            寃곌낵 ?먮쫫源뚯? ??踰덉뿉 蹂대뒗 ?꾨줈?앺듃 ?붾㈃?낅땲??
          </>
        }
      />

      {projectError ? <PageBanner message={projectError} tone="error" /> : null}


      {lastCreatedScan ? (
        <div className="hidden border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          ?ㅼ틪 #{lastCreatedScan.scanId} ?앹꽦???꾨즺?섏뿀?듬땲?? ?곸꽭 ?붾㈃?먯꽌 吏꾪뻾 ?곹깭瑜?諛붾줈 ?뺤씤?????덉뒿?덈떎.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard helper="吏꾪뻾 以묒씠嫄곕굹 遺꾩꽍 ?湲?以묒씤 ?ㅼ틪 ?섏엯?덈떎." label="吏꾪뻾 以??ㅼ틪" tone="sky" value={activeScans.length} />
        <MetricCard helper="寃곌낵瑜??뺤씤?????덈뒗 ?꾨즺 ?ㅼ틪 ?섏엯?덈떎." label="?꾨즺 ?ㅼ틪" tone="green" value={completedScans.length} />
        <MetricCard helper="?ㅽ뙣 ?먮뒗 痍⑥냼???ㅼ틪 ?섏엯?덈떎." label="?ㅽ뙣/痍⑥냼" tone="red" value={failedScans.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <SectionPanel
          description="Agent, CLI, ?낅줈??諛⑹떇 以??섎굹瑜?怨⑤씪 ???ㅼ틪???앹꽦?????덉뒿?덈떎."
          eyebrow="NEW SCAN"
          title="???ㅼ틪 ?붿껌"
        >
          <ScanRequestForm
            agentAvailable={Boolean(scanOptions?.availableScanModes.includes('AGENT'))}
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
        </SectionPanel>

        <div className="grid gap-4">
          <article className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="inline-flex bg-black p-3 text-white">
              <FolderOpen className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-black tracking-tight text-black">?꾨줈?앺듃 湲곕낯 ?뺣낫</h3>
            <dl className="mt-4 space-y-3 text-sm text-neutral-600">
              <div className="flex items-start justify-between gap-4 border-t border-neutral-100 pt-3">
                <dt className="font-semibold text-neutral-500">湲곕낯 ?ㅼ틪 諛⑹떇</dt>
                <dd className="text-right font-bold text-black">
                  {projectDetail ? getScanModeLabel(projectDetail.defaultScanMode) : '-'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-neutral-100 pt-3">
                <dt className="font-semibold text-neutral-500">紐⑤땲?곕쭅 ?곹깭</dt>
                <dd className="text-right font-bold text-black">
                  {projectDetail ? formatBooleanLabel(projectDetail.monitorEnabled) : '-'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-neutral-100 pt-3">
                <dt className="font-semibold text-neutral-500">전체 스캔 수</dt>
                <dd className="text-right font-bold text-black">{scans.length}</dd>
              </div>
            </dl>
          </article>

          <article className="border border-neutral-200 bg-black p-5 text-white shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#3ddc84]">WORKFLOW</p>
                <h3 className="mt-3 text-xl font-black tracking-tight">?ㅼ틪 ?ㅽ뻾遺??寃곌낵 ?뺤씤源뚯? ?댁뼱???묒뾽?????덉뒿?덈떎.</h3>
                <p className="mt-3 text-sm leading-7 text-neutral-300">
                  ???꾨줈?앺듃 ?덉뿉???ㅼ틪 ?붿껌怨??곹깭 ?뺤씤??諛섎났?섎㈃??媛숈? 臾몃㎘?쇰줈 寃곌낵瑜?怨꾩냽 愿由ы븷 ???덉뒿?덈떎.
                </p>
              </div>
              <PixelGoose mood="working" size={72} />
            </div>
          </article>

          <article className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="inline-flex bg-black p-3 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-black tracking-tight text-black">업로드 파일 가이드</h3>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              업로드 방식은 설정 파일을 기준으로 동작하며, 허용 파일 형식과 용량 제한은 스캔 시작 전에 바로 검증됩니다.
            </p>
          </article>

          <article className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="inline-flex bg-black p-3 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-black tracking-tight text-black">Agent ?곌껐 ?곹깭</h3>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              Agent媛 ?곌껐???꾨줈?앺듃???쒕쾭 痢??섏쭛 湲곕컲?쇰줈 ??鍮좊Ⅴ寃??ㅼ쓬 ?ㅼ틪???댁뼱媛????덉뒿?덈떎.
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
            <h3 className="text-xl font-black tracking-tight text-black">?댁쁺 硫붾え</h3>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              ???붾㈃? ?꾨줈?앺듃 ?곸꽭, Agent ?곹깭, ?ㅼ틪 紐⑸줉, ???ㅼ틪 ?붿껌 API瑜???踰덉뿉 ??뼱 ?뺤씤?섎뒗 ?댁쁺???붾㈃?낅땲??
            </p>
          </div>
        </div>
      </article>

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
