import { ShieldCheck, Sparkles, TerminalSquare, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { createProject, getProjects } from '../../features/projects/api/projects';
import ProjectCreateForm from '../../features/projects/components/ProjectCreateForm';
import ProjectSummaryCard from '../../features/projects/components/ProjectSummaryCard';
import WorkspaceStatCard from '../../features/projects/components/WorkspaceStatCard';
import { useProjectStore } from '../../store/projectStore';
import type { CreateProjectFormValues } from '../../types/project';

const initialProjectForm: CreateProjectFormValues = {
  name: '',
  description: '',
  defaultScanMode: 'AGENT',
  monitorEnabled: true,
};

const quickActions = [
  {
    title: '웹 업로드 체험',
    description:
      'docker-compose, .env 같은 핵심 파일을 빠르게 올리고 서버에서 즉시 점검 결과를 확인합니다.',
    icon: Upload,
  },
  {
    title: 'CLI 실사용 준비',
    description:
      '로컬 환경에서 마스킹 후 전체 프로젝트를 스캔하고, 배포 전후 보안 상태를 이력으로 관리합니다.',
    icon: TerminalSquare,
  },
  {
    title: '결정론적 탐지 기준',
    description:
      'AI가 취약점을 임의로 만들지 않고, 고정 룰셋과 스캔 결과를 바탕으로 설명과 수정안을 제공합니다.',
    icon: ShieldCheck,
  },
];

function ProjectListPage() {
  const projects = useProjectStore((state) => state.projects);
  const setProjectsFromList = useProjectStore((state) => state.setProjectsFromList);
  const addProject = useProjectStore((state) => state.addProject);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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

  const projectCount = projects.length;
  const monitoringCount = projects.filter((project) => project.monitorEnabled).length;
  const agentModeCount = projects.filter((project) => project.defaultScanMode === 'AGENT').length;

  const handleCreateProject = async () => {
    setIsCreating(true);
    setCreateError(null);

    try {
      const data = await createProject(formValues);

      addProject({
        id: String(data.projectId),
        name: formValues.name.trim(),
        owner: 'My Workspace',
        scans: 0,
        lastStatus: 'NEW',
        risk: 'LOW',
        description:
          formValues.description.trim() || '새 프로젝트가 생성되었습니다. 첫 스캔을 시작해 보안 이력을 쌓아보세요.',
        defaultScanMode: formValues.defaultScanMode,
        monitorEnabled: formValues.monitorEnabled,
        createdAt: new Date().toISOString(),
      });

      setFormValues(initialProjectForm);
      setIsCreateOpen(false);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : '프로젝트 생성에 실패했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-[#eadfcb] bg-[linear-gradient(135deg,#fffdf8_0%,#f6efe0_52%,#efe7d9_100%)] px-6 py-8 shadow-[0_24px_90px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#8b7f6a]">
              Security Workspace
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-[#111111] md:text-5xl">
              프로젝트 보안 상태를 이해하고,
              <br />
              바로 고칠 수 있는 작업 공간
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#5f564c]">
              SSAFER는 결정론적 탐지와 고정 룰셋을 기반으로 보안 설정을 점검하고,
              마스킹된 근거와 수정 제안을 함께 보여줍니다. 웹 업로드 체험부터 CLI 실사용,
              그리고 스캔 이력 비교까지 한 화면에서 이어가세요.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#262626]"
                onClick={() => setIsCreateOpen(true)}
                type="button"
              >
                <Sparkles className="h-4 w-4" />
                새 프로젝트 시작
              </button>
              <Link
                className="inline-flex rounded-full border border-[#cbbda6] px-5 py-3 text-sm font-bold text-[#3f352b] transition hover:border-[#9f937f]"
                to={ROUTES.resultDetail.replace(':scanId', 'scan-a36')}
              >
                최근 결과 미리보기
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <WorkspaceStatCard
              helper="보안 상태를 장기적으로 추적할 수 있는 현재 워크스페이스 기준 프로젝트 수입니다."
              label="프로젝트"
              value={String(projectCount)}
            />
            <WorkspaceStatCard
              helper="지속적으로 상태를 추적하도록 모니터링을 켜둔 프로젝트 수입니다."
              label="모니터링 활성화"
              value={String(monitoringCount)}
            />
            <WorkspaceStatCard
              helper="CLI 또는 에이전트 기반 스캔을 기본 방식으로 사용하는 프로젝트 수입니다."
              label="CLI / Agent 기본"
              value={String(agentModeCount)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {quickActions.map((item) => {
          const Icon = item.icon;

          return (
            <article
              className="rounded-[1.75rem] border border-[#ece5d8] bg-white p-6 shadow-[0_16px_60px_rgba(15,23,42,0.05)]"
              key={item.title}
            >
              <div className="inline-flex rounded-2xl bg-[#f8f2e8] p-3 text-[#2f241a]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-black text-[#111111]">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#675d51]">{item.description}</p>
            </article>
          );
        })}
      </div>

      {isCreateOpen ? (
        <ProjectCreateForm
          errorMessage={createError}
          isSubmitting={isCreating}
          onCancel={() => {
            setIsCreateOpen(false);
            setCreateError(null);
            setFormValues(initialProjectForm);
          }}
          onChange={setFormValues}
          onSubmit={() => void handleCreateProject()}
          value={formValues}
        />
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8b7f6a]">
              My Projects
            </p>
            <h3 className="mt-2 text-3xl font-black text-[#111111]">프로젝트 보안 워크스페이스</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6b6257]">
              웹 업로드 체험과 CLI 실사용 결과가 같은 프로젝트 맥락으로 이어지도록 구성했습니다.
              스캔 이력과 수정 우선순위를 한곳에서 관리하세요.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-[1.75rem] border border-[#ebe3d5] bg-white px-6 py-8 text-sm text-[#6b6257]">
            프로젝트 목록을 불러오는 중입니다.
          </div>
        ) : loadError ? (
          <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-6 py-5 text-sm font-medium text-rose-700">
            {loadError}
          </div>
        ) : projectCount === 0 ? (
          <div className="rounded-[1.9rem] border border-dashed border-[#d8cebb] bg-[#fffdfa] px-6 py-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8b7f6a]">
              First Project
            </p>
            <h4 className="mt-3 text-2xl font-black text-[#111111]">
              아직 등록된 프로젝트가 없습니다.
            </h4>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#675d51]">
              먼저 프로젝트를 만들고, 업로드 스캔 또는 CLI / Agent 스캔을 연결해 보세요.
              이후에는 Findings 설명, 수정안, 이력 비교가 프로젝트 단위로 쌓입니다.
            </p>
            <button
              className="mt-6 inline-flex rounded-full bg-[#111111] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#262626]"
              onClick={() => setIsCreateOpen(true)}
              type="button"
            >
              첫 프로젝트 만들기
            </button>
          </div>
        ) : (
          <div className="grid gap-5">
            {projects.map((project) => (
              <ProjectSummaryCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default ProjectListPage;
