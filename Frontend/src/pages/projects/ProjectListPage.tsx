import { FolderPlus, ScanSearch, ShieldCheck, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import MetricCard from '../../components/common/MetricCard';
import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import { createProject, getProjects } from '../../features/projects/api/projects';
import ProjectCreateForm from '../../features/projects/components/ProjectCreateForm';
import ProjectSummaryCard from '../../features/projects/components/ProjectSummaryCard';
import {
  createScanRequest,
  reportUploadedScanResult,
  uploadScanResultFile,
} from '../../features/scans/api/scans';
import { validateScanUploadFile } from '../../features/scans/utils/uploadValidation';
import { useProjectStore } from '../../store/projectStore';
import type { CreateProjectFormValues } from '../../types/project';

const initialProjectForm: CreateProjectFormValues = {
  name: '',
  description: '',
  defaultScanMode: 'AGENT',
  monitorEnabled: true,
};

const quickGuides = [
  {
    title: '프로젝트 만들기',
    description: '새 프로젝트를 만들고 기본 스캔 방식을 정해두면 이후 점검을 더 빠르게 시작할 수 있습니다.',
    icon: FolderPlus,
  },
  {
    title: '파일 업로드 스캔',
    description: '구성 파일을 바로 올려서 빠르게 결과를 확인하고 수정 포인트를 찾아볼 수 있습니다.',
    icon: Upload,
  },
  {
    title: 'Agent 모니터링',
    description: '연결된 서버의 상태를 확인하고 필요한 순간 즉시 점검을 다시 실행할 수 있습니다.',
    icon: ScanSearch,
  },
];

function ProjectListPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const setProjectsFromList = useProjectStore((state) => state.setProjectsFromList);
  const addProject = useProjectStore((state) => state.addProject);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<{ tone: 'success' | 'warning'; message: string } | null>(null);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [formValues, setFormValues] = useState<CreateProjectFormValues>(initialProjectForm);

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const data = await getProjects();

        if (!isMounted) {
          return;
        }

        setProjectsFromList(data.items, data.totalElements, data.totalPages);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : '프로젝트 목록을 불러오지 못했습니다.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProjects();

    return () => {
      isMounted = false;
    };
  }, [setProjectsFromList]);

  const resetCreateForm = () => {
    setFormValues(initialProjectForm);
    setSelectedUploadFile(null);
    setCreateError(null);
  };

  const handleUploadFileChange = (file: File | null) => {
    setSelectedUploadFile(file);

    if (!file) {
      setCreateError(null);
      return;
    }

    setCreateError(validateScanUploadFile(file));
  };

  const handleCreateProject = async () => {
    setCreateError(null);
    setCreateNotice(null);

    const uploadFile = selectedUploadFile;

    if (uploadFile) {
      const validationError = validateScanUploadFile(uploadFile);

      if (validationError) {
        setCreateError(validationError);
        return;
      }
    }

    setIsCreating(true);

    try {
      const projectData = await createProject(formValues);
      const projectId = String(projectData.projectId);
      const projectName = formValues.name.trim();
      const projectDescription = formValues.description.trim();

      addProject({
        id: projectId,
        name: projectName,
        owner: 'MY WORKSPACE',
        scans: 0,
        lastStatus: 'NEW',
        risk: 'LOW',
        description: projectDescription || '설명이 아직 없는 프로젝트입니다.',
        defaultScanMode: formValues.defaultScanMode,
        monitorEnabled: formValues.monitorEnabled,
        createdAt: new Date().toISOString(),
      });

      resetCreateForm();
      setIsCreateOpen(false);

      if (uploadFile) {
        try {
          const scanData = await createScanRequest({
            projectName,
            source: 'CLI',
            scanName: `${projectName} 빠른 업로드 스캔`,
            includeLogs: false,
          });

          await uploadScanResultFile(scanData.rawUploadUrl, uploadFile);
          await reportUploadedScanResult(scanData.scanId, uploadFile);

          navigate(ROUTES.scanDetail.replace(':scanId', String(scanData.scanId)), {
            state: { projectId, autoOpenedFromScanRequest: true },
          });
          return;
        } catch (error) {
          setCreateNotice({
            tone: 'warning',
            message:
              error instanceof Error
                ? `프로젝트는 생성되었지만 첫 스캔 업로드는 완료되지 않았습니다. ${error.message}`
                : '프로젝트는 생성되었지만 첫 스캔 업로드는 완료되지 않았습니다.',
          });
          return;
        }
      }

      setCreateNotice({
        tone: 'success',
        message: '프로젝트가 생성되었습니다. 이제 원하는 방식으로 첫 스캔을 시작할 수 있습니다.',
      });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '프로젝트를 생성하지 못했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const agentModeCount = projects.filter((project) => project.defaultScanMode === 'AGENT').length;
  const monitorEnabledCount = projects.filter((project) => project.monitorEnabled).length;

  return (
    <section className="space-y-8">
      <PageHero
        actions={
          <button
            className="inline-flex items-center gap-2 bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
            onClick={() => setIsCreateOpen(true)}
            type="button"
          >
            <FolderPlus className="h-4 w-4" />
            새 프로젝트
          </button>
        }
        aside={
          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">WORKSPACE</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-black">프로젝트를 만들고 바로 스캔을 시작하세요.</h2>
              </div>
              <PixelGoose mood="happy" size={88} />
            </div>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              업로드 스캔, CLI 실행, Agent 점검까지 한 곳에서 관리할 수 있도록 프로젝트 작업공간을 정리해두었습니다.
            </p>
          </div>
        }
        description="프로젝트를 기준으로 스캔 결과를 모아보고, 각 서비스별 위험도와 최근 상태를 관리할 수 있습니다."
        eyebrow="PROJECT WORKSPACE"
        title={
          <>
            프로젝트를 기준으로
            <br />
            보안 점검을 이어갑니다.
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard helper="현재 작업공간에 등록된 프로젝트 수입니다." label="전체 프로젝트" tone="plain" value={projects.length} />
        <MetricCard helper="Agent 기반 점검을 기본값으로 사용하는 프로젝트입니다." label="AGENT 기본 모드" tone="sky" value={agentModeCount} />
        <MetricCard helper="모니터링이 켜져 있는 프로젝트 수입니다." label="모니터링 사용" tone="amber" value={monitorEnabledCount} />
      </div>

      {createNotice ? (
        <div
          className={`border px-5 py-4 text-sm ${
            createNotice.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {createNotice.message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {quickGuides.map((item) => {
          const Icon = item.icon;

          return (
            <article className="border border-neutral-200 bg-white p-5 shadow-sm" key={item.title}>
              <div className="inline-flex bg-black p-3 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-xl font-black tracking-tight text-black">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-neutral-600">{item.description}</p>
            </article>
          );
        })}
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto shadow-[0_30px_120px_rgba(15,23,42,0.28)]">
            <ProjectCreateForm
              errorMessage={createError}
              isSubmitting={isCreating}
              onCancel={() => {
                setIsCreateOpen(false);
                resetCreateForm();
              }}
              onChange={setFormValues}
              onSubmit={() => void handleCreateProject()}
              onUploadFileChange={handleUploadFileChange}
              selectedUploadFile={selectedUploadFile}
              value={formValues}
            />
          </div>
        </div>
      ) : null}

      <SectionPanel
        description="프로젝트별 최근 상태를 보고, 필요한 서비스부터 결과 화면으로 바로 이동할 수 있습니다."
        eyebrow="PROJECT LIST"
        title="등록된 프로젝트"
      >
        {isLoading ? (
          <div className="border border-neutral-200 bg-[#fafafa] px-4 py-5 text-sm text-neutral-600">프로젝트 목록을 불러오는 중입니다...</div>
        ) : loadError ? (
          <div className="border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">{loadError}</div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-4 py-6 text-sm text-neutral-600">
            아직 등록된 프로젝트가 없습니다. 새 프로젝트를 만들어 첫 스캔을 시작해보세요.
          </div>
        ) : (
          <div className="grid gap-5">
            {projects.map((project) => (
              <ProjectSummaryCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </SectionPanel>

      <article className="border border-neutral-200 bg-black p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <PixelGoose mood="working" size={72} />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#3ddc84]">SECURITY NOTE</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight">환경 변수와 구성 파일부터 먼저 점검해보세요.</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-300">
                `.env`, `docker-compose.yml`, `Dockerfile`처럼 운영에 직접 영향을 주는 파일부터 확인하면 가장 빠르게 위험을 줄일 수 있습니다.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-[#3ddc84] px-4 py-2 text-sm font-bold text-black">
            <ShieldCheck className="h-4 w-4" />
            안전한 설정부터 시작
          </div>
        </div>
      </article>
    </section>
  );
}

export default ProjectListPage;
