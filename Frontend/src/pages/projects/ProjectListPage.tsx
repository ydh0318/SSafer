import { FolderPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import MetricCard from '../../components/common/MetricCard';
import ModalFrame from '../../components/common/ModalFrame';
import PageHero from '../../components/common/PageHero';
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
        description: projectDescription || '설명 없음',
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
            scanName: `${projectName} 업로드 스캔`,
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
                ? `프로젝트는 생성되었지만 스캔 시작에 실패했습니다. ${error.message}`
                : '프로젝트는 생성되었지만 스캔 시작에 실패했습니다.',
          });
          return;
        }
      }

      setCreateNotice({
        tone: 'success',
        message: '프로젝트를 생성했습니다.',
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
        description={null}
        eyebrow="PROJECTS"
        title="프로젝트"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="전체 프로젝트" tone="plain" value={projects.length} />
        <MetricCard label="기본 모드 AGENT" tone="sky" value={agentModeCount} />
        <MetricCard label="모니터링 사용" tone="amber" value={monitorEnabledCount} />
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

      {isCreateOpen ? (
        <ModalFrame
          onClose={() => {
            setIsCreateOpen(false);
            resetCreateForm();
          }}
        >
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
        </ModalFrame>
      ) : null}

      <SectionPanel eyebrow="PROJECT LIST" title="프로젝트 목록">
        {isLoading ? (
          <div className="border border-neutral-200 bg-[#fafafa] px-4 py-5 text-sm text-neutral-600">불러오는 중...</div>
        ) : loadError ? (
          <div className="border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">{loadError}</div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-4 py-6 text-sm text-neutral-600">
            등록된 프로젝트가 없습니다.
          </div>
        ) : (
          <div className="grid gap-5">
            {projects.map((project) => (
              <ProjectSummaryCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </SectionPanel>
    </section>
  );
}

export default ProjectListPage;
