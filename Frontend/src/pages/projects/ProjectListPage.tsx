import { LoaderCircle, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { SeverityBadge, StatusPill } from '../../components/common/Badge';
import MetricCard from '../../components/common/MetricCard';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import { createProject, getProjectDetail, getProjects } from '../../features/projects/api/projects';
import ProjectCreateForm from '../../features/projects/components/ProjectCreateForm';
import { useProjectStore } from '../../store/projectStore';
import type { CreateProjectFormValues } from '../../types/project';

const DEFAULT_FORM_VALUES: CreateProjectFormValues = {
  name: '',
  description: '',
  defaultScanMode: 'AGENT',
  monitorEnabled: false,
};

function ProjectListPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const totalElements = useProjectStore((state) => state.totalElements);
  const addProject = useProjectStore((state) => state.addProject);
  const setProjectsFromList = useProjectStore((state) => state.setProjectsFromList);
  const upsertProjectDetail = useProjectStore((state) => state.upsertProjectDetail);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<CreateProjectFormValues>(DEFAULT_FORM_VALUES);

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      setIsLoadingProjects(true);
      setPageError(null);

      try {
        const response = await getProjects();

        if (!isMounted) {
          return;
        }

        setProjectsFromList(response.items, response.totalElements, response.totalPages);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageError(
          error instanceof Error ? error.message : '프로젝트 목록을 불러오지 못했습니다.',
        );
      } finally {
        if (isMounted) {
          setIsLoadingProjects(false);
        }
      }
    };

    void loadProjects();

    return () => {
      isMounted = false;
    };
  }, [setProjectsFromList]);

  const guestProjectCount = useMemo(
    () => projects.filter((project) => project.owner.toLowerCase().includes('guest')).length,
    [projects],
  );

  const activeScanCount = useMemo(
    () => projects.filter((project) => project.lastStatus === 'ANALYZING').length,
    [projects],
  );

  const searchableNames = useMemo(
    () => projects.map((project) => project.name).join(', '),
    [projects],
  );

  const resetForm = () => {
    setFormValues(DEFAULT_FORM_VALUES);
    setSubmitError(null);
  };

  const handleCreateToggle = () => {
    setIsCreateOpen((prev) => !prev);
    setSubmitError(null);
  };

  const handleCreateSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await createProject(formValues);
      const createdId = String(created.projectId);
      const createdDetail = await getProjectDetail(createdId);

      upsertProjectDetail(createdDetail);
      addProject({
        id: createdId,
        name: createdDetail.name,
        description: createdDetail.description?.trim() || '설명이 아직 등록되지 않았습니다.',
        owner: 'Guest Workspace',
        scans: 0,
        lastStatus: 'NEW',
        risk: 'LOW',
        defaultScanMode: createdDetail.defaultScanMode,
        monitorEnabled: createdDetail.monitorEnabled,
      });

      resetForm();
      setIsCreateOpen(false);
      navigate(ROUTES.projectDetail.replace(':projectId', createdId));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '프로젝트 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          helper="현재 접근 가능한 전체 프로젝트 수"
          label="Projects"
          value={totalElements || projects.length}
        />
        <MetricCard
          helper="분석이 진행 중인 프로젝트 수"
          label="Active scans"
          tone="sky"
          value={activeScanCount}
        />
        <MetricCard
          helper="게스트 세션으로 생성한 프로젝트 수"
          label="Guest projects"
          tone="green"
          value={guestProjectCount}
        />
      </div>

      <SectionPanel
        action={
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            onClick={handleCreateToggle}
            type="button"
          >
            <Plus className="h-4 w-4" />
            {isCreateOpen ? '생성 닫기' : '프로젝트 생성'}
          </button>
        }
        description="프로젝트를 만들고 최근 작업 흐름을 한눈에 확인할 수 있습니다."
        eyebrow="Projects"
        title="프로젝트 목록"
      >
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-500">
            {searchableNames || '아직 생성된 프로젝트가 없습니다.'}
          </span>
        </div>

        {isCreateOpen ? (
          <div className="mb-5">
            <ProjectCreateForm
              description="프로젝트 이름과 설명, 기본 스캔 방식, 모니터링 여부를 설정합니다."
              errorMessage={submitError}
              isSubmitting={isSubmitting}
              onCancel={() => {
                resetForm();
                setIsCreateOpen(false);
              }}
              onChange={setFormValues}
              onSubmit={handleCreateSubmit}
              value={formValues}
            />
          </div>
        ) : null}

        {pageError ? (
          <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {pageError}
          </div>
        ) : null}

        {isLoadingProjects ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            프로젝트 목록을 불러오는 중입니다.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-slate-950 hover:bg-white"
                key={project.id}
                to={ROUTES.projectDetail.replace(':projectId', project.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <SeverityBadge value={project.risk} />
                  <StatusPill value={project.lastStatus} />
                </div>
                <h3 className="mt-5 text-xl font-black text-slate-950">{project.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{project.owner}</p>
                <p className="mt-3 text-sm leading-6 text-slate-500">{project.description}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-700">
                  <span>기본 스캔 {project.defaultScanMode}</span>
                  <span>{project.monitorEnabled ? '모니터링 사용' : '모니터링 미사용'}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionPanel>
    </div>
  );
}

export default ProjectListPage;
