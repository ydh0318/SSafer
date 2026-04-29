import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { SeverityBadge, StatusPill } from '../../components/common/Badge';
import MetricCard from '../../components/common/MetricCard';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';
import ProjectCreateForm from '../../features/projects/components/ProjectCreateForm';
import { createProject } from '../../features/projects/api/projects';
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
  const addProject = useProjectStore((state) => state.addProject);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<CreateProjectFormValues>(DEFAULT_FORM_VALUES);

  const guestProjectCount = useMemo(
    () => projects.filter((project) => project.owner.toLowerCase().includes('guest')).length,
    [projects],
  );

  const activeScanCount = useMemo(
    () => projects.filter((project) => project.lastStatus === 'ANALYZING').length,
    [projects],
  );

  const searchableNames = useMemo(() => projects.map((project) => project.name).join(', '), [projects]);

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

      addProject({
        id: String(created.projectId),
        name: formValues.name.trim(),
        description: formValues.description.trim() || '설명이 아직 없는 새 프로젝트입니다.',
        owner: 'Guest Workspace',
        scans: 0,
        lastStatus: 'NEW',
        risk: 'LOW',
        defaultScanMode: formValues.defaultScanMode,
        monitorEnabled: formValues.monitorEnabled,
      });

      resetForm();
      setIsCreateOpen(false);
      navigate(ROUTES.projectDetail.replace(':projectId', String(created.projectId)));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '프로젝트 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard helper="회원과 게스트 모두 생성 가능" label="Projects" value={projects.length} />
          <MetricCard helper="현재 분석 상태인 프로젝트 수" label="Active scans" tone="sky" value={activeScanCount} />
          <MetricCard helper="게스트 세션에서 만든 프로젝트 수" label="Guest projects" tone="green" value={guestProjectCount} />
        </div>

        <SectionPanel
          action={
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              onClick={handleCreateToggle}
              type="button"
            >
              <Plus className="h-4 w-4" />
              {isCreateOpen ? '생성 폼 닫기' : '프로젝트 생성'}
            </button>
          }
          description="프로젝트 생성 API를 연결하고, 생성 직후 목록과 상세 화면에 반영되도록 프론트 상태를 함께 관리합니다."
          eyebrow="Project index"
          title="프로젝트 목록"
        >
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-500">{searchableNames || '생성된 프로젝트 이름이 여기에 표시됩니다.'}</span>
          </div>

          {isCreateOpen ? (
            <div className="mb-5">
              <ProjectCreateForm
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
                <p className="mt-4 text-sm font-bold text-slate-700">스캔 {project.scans}회</p>
              </Link>
            ))}
          </div>
        </SectionPanel>
      </div>

      <ApiEndpointList compact screenId="projects" />
    </div>
  );
}

export default ProjectListPage;
