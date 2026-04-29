import { Edit3, LoaderCircle, Play, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { SeverityBadge, StatusPill } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import ProjectCreateForm from '../../features/projects/components/ProjectCreateForm';
import { deleteProject, getProjectDetail, updateProject } from '../../features/projects/api/projects';
import { scans } from '../../mocks/ssaferMockData';
import { useProjectStore } from '../../store/projectStore';
import type { CreateProjectFormValues } from '../../types/project';

function isValidProjectId(projectId: string) {
  return /^\d+$/.test(projectId);
}

function mapProjectToFormValues(project: {
  name: string;
  description: string;
  defaultScanMode: 'UPLOAD' | 'AGENT';
  monitorEnabled: boolean;
}): CreateProjectFormValues {
  return {
    name: project.name,
    description: project.description,
    defaultScanMode: project.defaultScanMode,
    monitorEnabled: project.monitorEnabled,
  };
}

function ProjectDetailPage() {
  const navigate = useNavigate();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const normalizedProjectId = isValidProjectId(projectId) ? projectId : null;
  const project = useProjectStore((state) =>
    normalizedProjectId ? state.findProjectById(normalizedProjectId) : undefined,
  );
  const upsertProjectDetail = useProjectStore((state) => state.upsertProjectDetail);
  const removeProject = useProjectStore((state) => state.removeProject);

  const [isLoading, setIsLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<CreateProjectFormValues>({
    name: '',
    description: '',
    defaultScanMode: 'AGENT',
    monitorEnabled: false,
  });

  useEffect(() => {
    if (normalizedProjectId) {
      return;
    }

    navigate(ROUTES.projects, { replace: true });
  }, [navigate, normalizedProjectId]);

  useEffect(() => {
    if (!normalizedProjectId) {
      return;
    }

    let isMounted = true;

    const loadProject = async () => {
      setIsLoading(true);

      try {
        const detail = await getProjectDetail(normalizedProjectId);

        if (!isMounted) {
          return;
        }

        upsertProjectDetail(detail);
      } catch {
        if (!isMounted) {
          return;
        }

        removeProject(normalizedProjectId);
        navigate(ROUTES.projects, { replace: true });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProject();

    return () => {
      isMounted = false;
    };
  }, [navigate, normalizedProjectId, removeProject, upsertProjectDetail]);

  useEffect(() => {
    if (!project) {
      return;
    }

    setFormValues(mapProjectToFormValues(project));
  }, [project]);

  const projectScans = useMemo(
    () => scans.filter((scan) => scan.project === project?.name),
    [project?.name],
  );

  const handleEditSubmit = async () => {
    if (!project) {
      return;
    }

    setIsSaving(true);
    setEditError(null);

    try {
      await updateProject(project.id, {
        name: formValues.name.trim() || undefined,
        description: formValues.description.trim() ? formValues.description.trim() : null,
        defaultScanMode: formValues.defaultScanMode,
        monitorEnabled: formValues.monitorEnabled,
      });

      const refreshed = await getProjectDetail(project.id);
      upsertProjectDetail(refreshed);
      setIsEditOpen(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : '프로젝트 수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project) {
      return;
    }

    const confirmed = window.confirm(`"${project.name}" 프로젝트를 삭제할까요?`);

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setEditError(null);

    try {
      await deleteProject(project.id);
      removeProject(project.id);
      navigate(ROUTES.projects, { replace: true });
    } catch (error) {
      setEditError(error instanceof Error ? error.message : '프로젝트 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!normalizedProjectId) {
    return null;
  }

  if (isLoading && !project) {
    return (
      <SectionPanel
        description="프로젝트 상세 정보를 불러오는 중입니다."
        eyebrow="Loading"
        title="프로젝트 상세"
      >
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          프로젝트 정보를 불러오고 있습니다.
        </div>
      </SectionPanel>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="space-y-6">
      <SectionPanel
        action={
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400"
              onClick={() => {
                setEditError(null);
                setFormValues(mapProjectToFormValues(project));
                setIsEditOpen((prev) => !prev);
              }}
              type="button"
            >
              <Edit3 className="h-4 w-4" />
              {isEditOpen ? '수정 취소' : '정보 수정'}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isDeleting}
              onClick={handleDelete}
              type="button"
            >
              {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              삭제
            </button>
            <Link
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              to={ROUTES.scanRequest.replace(':projectId', project.id)}
            >
              <Play className="h-4 w-4" />
              스캔 요청
            </Link>
          </div>
        }
        description="프로젝트 기본 정보와 현재 상태를 확인할 수 있습니다."
        eyebrow={project.id}
        title={project.name}
      >
        <div className="flex flex-wrap gap-2">
          <SeverityBadge value={project.risk} />
          <StatusPill value={project.lastStatus} />
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">{project.description}</p>
        {project.createdAt ? (
          <p className="mt-2 text-xs font-semibold text-slate-400">생성일 {project.createdAt}</p>
        ) : null}
      </SectionPanel>

      {isEditOpen ? (
        <ProjectCreateForm
          description="프로젝트 이름과 설명, 기본 스캔 방식, 모니터링 여부를 수정합니다."
          errorMessage={editError}
          isSubmitting={isSaving}
          onCancel={() => {
            setIsEditOpen(false);
            setEditError(null);
            setFormValues(mapProjectToFormValues(project));
          }}
          onChange={setFormValues}
          onSubmit={handleEditSubmit}
          submitLabel="프로젝트 수정"
          title="프로젝트 정보 수정"
          value={formValues}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <OptionCard
          desc={
            project.monitorEnabled
              ? '모니터링이 활성화되어 실시간 감시를 사용할 수 있습니다.'
              : '모니터링이 비활성화되어 있으며 필요 시 설정에서 켤 수 있습니다.'
          }
          title="모니터링"
        />
        <OptionCard
          desc={`${project.defaultScanMode} 방식이 기본 스캔 모드로 설정되어 있습니다.`}
          title="기본 스캔 방식"
        />
        <OptionCard
          desc="프로젝트를 삭제하면 목록 화면으로 이동하며, 삭제된 상세 주소는 더 이상 유지되지 않습니다."
          title="삭제 후 동작"
        />
      </div>

      <SectionPanel
        description="이 프로젝트와 연결된 최근 스캔 흐름을 확인합니다."
        eyebrow="Scans"
        title="프로젝트 스캔 이력"
      >
        {projectScans.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            아직 연결된 스캔 이력이 없습니다. 스캔 요청을 생성하면 이 영역에 최근 결과가 표시됩니다.
          </div>
        ) : (
          <div className="space-y-3">
            {projectScans.map((scan) => (
              <Link
                className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                key={scan.id}
                to={ROUTES.scanDetail.replace(':scanId', scan.id)}
              >
                <div>
                  <p className="font-mono text-sm font-black text-slate-950">{scan.id}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {scan.source} / {scan.scannedAt}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill value={scan.status} />
                  {scan.critical > 0 ? <SeverityBadge value="CRITICAL" /> : null}
                  {scan.high > 0 ? <SeverityBadge value="HIGH" /> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionPanel>
    </div>
  );
}

function OptionCard({ title, desc }: { title: string; desc: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        <StatusPill value="DONE" />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{desc}</p>
    </article>
  );
}

export default ProjectDetailPage;
