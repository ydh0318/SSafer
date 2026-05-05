import { FolderPlus, ScanSearch, ShieldCheck, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import MetricCard from '../../components/common/MetricCard';
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
    title: '프로젝트 생성',
    description: '새 프로젝트를 만들고 기본 스캔 방식을 정리한 뒤 바로 다음 단계로 넘어갈 수 있습니다.',
    icon: FolderPlus,
  },
  {
    title: '생성과 동시에 업로드',
    description: '프로젝트를 만드는 순간 첫 스캔 결과 JSON 파일까지 함께 올려 초기 스캔 이력을 바로 만들 수 있습니다.',
    icon: Upload,
  },
  {
    title: '상태와 결과 확인',
    description: '생성된 프로젝트나 스캔 상태 페이지로 이동해 진행 여부와 결과 흐름을 이어서 확인할 수 있습니다.',
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

  const handleCreateProject = async () => {
    setIsCreating(true);
    setCreateError(null);
    setCreateNotice(null);

    try {
      const projectData = await createProject(formValues);
      const projectId = String(projectData.projectId);
      const projectName = formValues.name.trim();
      const projectDescription = formValues.description.trim();

      addProject({
        id: projectId,
        name: projectName,
        owner: '내 워크스페이스',
        scans: 0,
        lastStatus: 'NEW',
        risk: 'LOW',
        description: projectDescription || '설명이 아직 등록되지 않았습니다.',
        defaultScanMode: formValues.defaultScanMode,
        monitorEnabled: formValues.monitorEnabled,
        createdAt: new Date().toISOString(),
      });

      const uploadFile = selectedUploadFile;

      resetCreateForm();
      setIsCreateOpen(false);

      if (uploadFile) {
        try {
          const scanData = await createScanRequest({
            projectName,
            source: 'CLI',
            scanName: `${projectName} 초기 업로드 스캔`,
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
                ? `프로젝트는 생성되었지만 초기 업로드 스캔 등록은 완료되지 않았습니다. ${error.message}`
                : '프로젝트는 생성되었지만 초기 업로드 스캔 등록은 완료되지 않았습니다.',
          });
          return;
        }
      }

      setCreateNotice({
        tone: 'success',
        message: '프로젝트가 생성되었습니다. 이제 프로젝트 상세에서 스캔을 시작할 수 있습니다.',
      });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '프로젝트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-[#eadfcb] bg-[linear-gradient(135deg,#fffdf8_0%,#f6efe0_52%,#efe7d9_100%)] px-6 py-8 shadow-[0_24px_90px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#8b7f6a]">프로젝트 관리</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-[#111111] md:text-5xl">
              프로젝트를 만들고
              <br />
              필요하면 첫 스캔 파일까지 바로 등록하세요
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#5f564c]">
              이제 새 프로젝트 생성 단계에서 프로젝트만 만들 수도 있고, 생성과 동시에 첫 스캔 결과 파일을 업로드해 바로 이력을 시작할 수도 있습니다.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#262626]"
                onClick={() => setIsCreateOpen(true)}
                type="button"
              >
                <FolderPlus className="h-4 w-4" />
                새 프로젝트 시작
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            <MetricCard helper="현재 저장된 프로젝트 수입니다." label="프로젝트 수" tone="plain" value={projects.length} />
            <MetricCard
              helper="에이전트 스캔을 기본으로 쓰는 프로젝트 수입니다."
              label="에이전트 기본"
              tone="sky"
              value={projects.filter((project) => project.defaultScanMode === 'AGENT').length}
            />
            <MetricCard
              helper="모니터링이 활성화된 프로젝트 수입니다."
              label="모니터링 사용"
              tone="amber"
              value={projects.filter((project) => project.monitorEnabled).length}
            />
          </div>
        </div>
      </section>

      {createNotice ? (
        <div
          className={`rounded-2xl px-5 py-4 text-sm ${
            createNotice.tone === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {createNotice.message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {quickGuides.map((item) => {
          const Icon = item.icon;

          return (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={item.title}>
              <div className="inline-flex rounded-2xl bg-slate-100 p-3 text-slate-900">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-xl font-black text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
            </article>
          );
        })}
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] bg-[#fffdfa] shadow-[0_30px_120px_rgba(15,23,42,0.28)]">
            <ProjectCreateForm
              errorMessage={createError}
              isSubmitting={isCreating}
              onCancel={() => {
                setIsCreateOpen(false);
                resetCreateForm();
              }}
              onChange={setFormValues}
              onSubmit={() => void handleCreateProject()}
              onUploadFileChange={setSelectedUploadFile}
              selectedUploadFile={selectedUploadFile}
              value={formValues}
            />
          </div>
        </div>
      ) : null}

      <SectionPanel
        description="생성된 프로젝트를 눌러 상세 화면으로 들어가면 스캔 요청, 상태 확인, 결과 흐름 확인까지 이어서 진행할 수 있습니다."
        eyebrow="프로젝트 목록"
        title="등록된 프로젝트"
      >
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            프로젝트 목록을 불러오는 중입니다...
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
            {loadError}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            아직 프로젝트가 없습니다. 먼저 새 프로젝트를 만들어보세요.
          </div>
        ) : (
          <div className="grid gap-5">
            {projects.map((project) => (
              <ProjectSummaryCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </SectionPanel>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="inline-flex rounded-2xl bg-slate-100 p-3 text-slate-900">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-xl font-black text-slate-950">정리된 생성 흐름</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          파일 없이 생성하면 프로젝트만 만들어지고, 파일을 함께 선택하면 생성 직후 첫 업로드 스캔까지 자동으로 이어집니다.
        </p>
      </article>
    </section>
  );
}

export default ProjectListPage;
