import { ArrowRight, Clock, FolderPlus, Lock, Plus, ScanSearch, Server, Terminal, Trash2, Upload, Wrench, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ModalFrame from '../../components/common/ModalFrame';
import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { useToast } from '../../features/feedback/useToast';
import { createProject, getProjects } from '../../features/projects/api/projects';
import ProjectCreateForm from '../../features/projects/components/ProjectCreateForm';
import ProjectDeleteModal from '../../features/projects/components/ProjectDeleteModal';
import useProjectDeleteFlow from '../../features/projects/hooks/useProjectDeleteFlow';
import {
  createScanRequest,
  getProjectScanOptions,
  getProjectScans,
  requestAgentScan,
  requestUploadScan,
} from '../../features/scans/api/scans';
import { formatCompactDateTime, getScanModeLabel } from '../../features/scans/utils/scanPresentation';
import { getUploadScanToastFeedback, getUploadScanValidationToastMessage } from '../../features/scans/utils/uploadScanFeedback';
import { getScanUploadValidationIssue } from '../../features/scans/utils/uploadValidation';
import { useScanEventSubscription } from '../../features/scans/hooks/useScanEventSubscription';
import { useProjectStore } from '../../store/projectStore';
import type { CreateProjectFormValues, ProjectSummary } from '../../types/project';
import type { ProjectScanListItemData, ProjectScanOptionsData, ScanType } from '../../types/scan';

type ScanModeOption = 'UPLOAD' | 'CLI' | 'AGENT';

type LatestCompletedScanMap = Record<
  string,
  {
    projectId: string;
    projectName: string;
    scan: ProjectScanListItemData;
  }
>;

const initialProjectForm: CreateProjectFormValues = {
  name: '',
  description: '',
  defaultScanMode: 'AGENT',
  monitorEnabled: true,
};

const modeCards: Array<{
  description: string;
  icon: typeof Upload;
  id: ScanModeOption;
  title: string;
}> = [
  {
    id: 'UPLOAD',
    icon: Upload,
    title: '파일 업로드',
    description: '설정 파일을 바로 올려 빠르게 결과를 확인하고 싶을 때 적합합니다.',
  },
  {
    id: 'CLI',
    icon: Terminal,
    title: 'CLI',
    description: '로컬 또는 CI 환경에서 명령어 기반으로 스캔을 실행하고 싶을 때 사용합니다.',
  },
  {
    id: 'AGENT',
    icon: Server,
    title: 'Agent',
    description: '연결된 Local Agent를 통해 실제 서버나 실행 환경 기준으로 점검합니다.',
  },
];

function normalizeProjectName(value: string) {
  return value.trim();
}

function getAgentTone(project: ProjectSummary, isSelected: boolean) {
  if (!project.monitorEnabled) {
    return isSelected ? 'text-neutral-400' : 'text-neutral-500';
  }

  return isSelected ? 'text-[#D4FC64]' : 'text-[#8CC319]';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.ceil(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ProjectListPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const setProjectsFromList = useProjectStore((state) => state.setProjectsFromList);
  const addProject = useProjectStore((state) => state.addProject);
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ScanModeOption>('UPLOAD');
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const [createUploadFiles, setCreateUploadFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [formValues, setFormValues] = useState<CreateProjectFormValues>(initialProjectForm);
  const [latestCompletedScans, setLatestCompletedScans] = useState<LatestCompletedScanMap>({});
  const [isLoadingCompletedScans, setIsLoadingCompletedScans] = useState(false);
  const [selectedProjectScanOptions, setSelectedProjectScanOptions] = useState<ProjectScanOptionsData | null>(null);
  const [completedScansRefreshKey, setCompletedScansRefreshKey] = useState(0);
  const [selectedAgentScanType, setSelectedAgentScanType] = useState<ScanType>('PROJECT_FILE');
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useScanEventSubscription(
    () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        setCompletedScansRefreshKey((key) => key + 1);
      }, 500);
    },
    () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        setCompletedScansRefreshKey((key) => key + 1);
      }, 500);
    },
  );

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  const {
    closeDeleteModal,
    confirmDelete,
    errorMessage: deleteProjectError,
    isDeleteModalOpen,
    isDeleting: isDeletingProject,
    openDeleteModal,
    targetProject,
  } = useProjectDeleteFlow({
    onDeleted: (project) => {
      toast.success(`${project.name} 프로젝트가 삭제되었습니다.`);
    },
  });

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
        console.error('Failed to load projects.', error);

        if (isMounted) {
          setLoadError('프로젝트 목록을 불러오지 못했습니다.');
        }
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

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (projects.length === 0) {
      setLatestCompletedScans({});
      setIsLoadingCompletedScans(false);
      return;
    }

    let isMounted = true;

    const loadCompletedScans = async () => {
      setIsLoadingCompletedScans(true);

      try {
        const scanResponses = await Promise.all(
          projects.map(async (project) => {
            const response = await getProjectScans(project.id, { page: 0, size: 10 });
            const latestDoneScan = response.items
              .filter((scan) => scan.status === 'DONE')
              .sort((left, right) => {
                const leftTime = new Date(left.completedAt ?? left.requestedAt).getTime();
                const rightTime = new Date(right.completedAt ?? right.requestedAt).getTime();
                return rightTime - leftTime;
              })[0];

            if (!latestDoneScan) {
              return null;
            }

            return {
              projectId: project.id,
              projectName: project.name,
              scan: latestDoneScan,
            };
          }),
        );

        if (!isMounted) {
          return;
        }

        const nextMap = scanResponses.reduce<LatestCompletedScanMap>((accumulator, item) => {
          if (item) {
            accumulator[item.projectId] = item;
          }

          return accumulator;
        }, {});

        setLatestCompletedScans(nextMap);
      } catch (error) {
        console.error('Failed to load latest completed scans.', error);

        if (isMounted) {
          setLatestCompletedScans({});
        }
      } finally {
        if (isMounted) {
          setIsLoadingCompletedScans(false);
        }
      }
    };

    void loadCompletedScans();

    return () => {
      isMounted = false;
    };
  }, [projects, completedScansRefreshKey]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    if (!selectedProject) {
      setSelectedProjectScanOptions(null);
      return;
    }

    let isMounted = true;

    const loadScanOptions = async () => {
      try {
        const data = await getProjectScanOptions(selectedProject.id);

        if (!isMounted) {
          return;
        }

        setSelectedProjectScanOptions(data);

        const nextMode =
          data.defaultScanMode === 'AGENT' && data.availableScanModes.includes('AGENT') ? 'AGENT' : 'UPLOAD';

        setSelectedMode((current) => (current === 'CLI' ? current : nextMode));
      } catch (error) {
        console.error('Failed to load scan options.', error);

        if (isMounted) {
          setSelectedProjectScanOptions(null);
          setSelectedMode((current) => (current === 'AGENT' ? 'UPLOAD' : current));
        }
      }
    };

    void loadScanOptions();

    return () => {
      isMounted = false;
    };
  }, [selectedProject]);

  const completedProjectEntries = useMemo(
    () =>
      projects
        .map((project) => {
          const latestCompleted = latestCompletedScans[project.id];

          if (!latestCompleted) {
            return null;
          }

          return { latestCompleted, project };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((left, right) => {
          const leftTime = new Date(left.latestCompleted.scan.completedAt ?? left.latestCompleted.scan.requestedAt).getTime();
          const rightTime = new Date(right.latestCompleted.scan.completedAt ?? right.latestCompleted.scan.requestedAt).getTime();
          return rightTime - leftTime;
        }),
    [latestCompletedScans, projects],
  );

  const uploadStats = useMemo(() => {
    const totalBytes = selectedUploadFiles.reduce((sum, file) => sum + file.size, 0);
    return {
      count: selectedUploadFiles.length,
      totalBytes,
      remainingCount: Math.max(3 - selectedUploadFiles.length, 0),
      remainingBytes: Math.max(1024 * 1024 - totalBytes, 0),
    };
  }, [selectedUploadFiles]);

  const resetCreateForm = () => {
    setFormValues(initialProjectForm);
    setCreateUploadFiles([]);
    setCreateError(null);
  };

  const handleUploadFileChange = (files: File[] | null) => {
    setSelectedUploadFiles(files ?? []);
    setScanError(null);
  };

  const handleCreateUploadFileChange = (files: File[] | null) => {
    setCreateUploadFiles(files ?? []);
    setCreateError(null);
  };

  const handleCreateProject = async () => {
    setCreateError(null);

    const projectName = normalizeProjectName(formValues.name);

    if (projects.some((project) => normalizeProjectName(project.name) === projectName)) {
      setCreateError('같은 이름의 프로젝트가 이미 있습니다. 다른 이름으로 다시 시도해 주세요.');
      return;
    }

    if (createUploadFiles.length > 0) {
      const validationIssue = getScanUploadValidationIssue(createUploadFiles);

      if (validationIssue) {
        toast.warning(getUploadScanValidationToastMessage(validationIssue) ?? '업로드 파일을 확인해주세요.', {
          durationMs: 3000,
        });
        return;
      }
    }

    setIsCreating(true);

    try {
      const projectData = await createProject(formValues);
      const projectDescription = formValues.description.trim();
      const nextProject: ProjectSummary = {
        id: String(projectData.projectId),
        name: projectName,
        owner: 'MY WORKSPACE',
        scans: 0,
        lastStatus: 'NEW',
        risk: 'LOW',
        description: projectDescription || '프로젝트 설명이 아직 없습니다.',
        defaultScanMode: formValues.defaultScanMode,
        monitorEnabled: formValues.monitorEnabled,
        createdAt: new Date().toISOString(),
      };

      addProject(nextProject);
      setSelectedProjectId(nextProject.id);
      resetCreateForm();
      setIsCreateOpen(false);

      if (createUploadFiles.length > 0) {
        try {
          const scanData = await requestUploadScan({
            projectName,
            scanName: `${projectName} 초기 스캔`,
            files: createUploadFiles,
          });
          navigate(ROUTES.scanDetail.replace(':scanId', String(scanData.scanId)), {
            state: { autoOpenedFromScanRequest: true, projectId: nextProject.id },
          });
          return;
        } catch (error) {
          console.error('Failed to start initial scan after project creation.', error);
          const feedback = getUploadScanToastFeedback(error, 'project-create');
          if (feedback.tone === 'warning') {
            toast.warning(feedback.message, { durationMs: 3000 });
          } else {
            toast.error(feedback.message, { durationMs: 3000 });
          }
          return;
        }
      }

      toast.success('프로젝트가 생성되었습니다.');
    } catch (error) {
      console.error('Failed to create project.', error);
      setCreateError('프로젝트 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartScan = async () => {
    if (!selectedProject) {
      setScanError('먼저 프로젝트를 선택해 주세요.');
      return;
    }

    if (selectedMode === 'AGENT' && !selectedProjectScanOptions?.availableScanModes.includes('AGENT')) {
      setScanError('이 프로젝트에서는 아직 Agent 스캔을 사용할 수 없습니다.');
      return;
    }

    if (selectedMode === 'UPLOAD') {
      const validationIssue = getScanUploadValidationIssue(selectedUploadFiles);

      if (validationIssue) {
        toast.warning(getUploadScanValidationToastMessage(validationIssue) ?? '업로드 파일을 확인해주세요.', {
          durationMs: 3000,
        });
        return;
      }
    }

    setIsStartingScan(true);
    setScanError(null);

    try {
      let scanData: { scanId: number };

      if (selectedMode === 'UPLOAD' && selectedUploadFiles.length > 0) {
        scanData = await requestUploadScan({
          projectName: selectedProject.name,
          scanName: `${selectedProject.name} 업로드 스캔`,
          files: selectedUploadFiles,
        });
      } else if (selectedMode === 'AGENT') {
        scanData = await requestAgentScan(String(selectedProject.id), {
          targetPath: '.',
          scanType: selectedAgentScanType,
          scanName: `${selectedProject.name} Agent 스캔`,
          includeLogs: false,
        });
      } else {
        scanData = await createScanRequest({
          projectName: selectedProject.name,
          source: 'CLI',
          scanName: `${selectedProject.name} CLI 스캔`,
          includeLogs: false,
        });
      }

      navigate(ROUTES.scanDetail.replace(':scanId', String(scanData.scanId)), {
        state: { autoOpenedFromScanRequest: true, projectId: selectedProject.id },
      });
    } catch (error) {
      console.error('Failed to start scan.', error);

      if (selectedMode === 'UPLOAD') {
        const feedback = getUploadScanToastFeedback(error, 'project-list');
        if (feedback.tone === 'warning') {
          toast.warning(feedback.message, { durationMs: 3000 });
        } else {
          toast.error(feedback.message, { durationMs: 3000 });
        }
        return;
      }

      setScanError('스캔 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsStartingScan(false);
    }
  };

  return (
    <section className="space-y-10">
      <header className="flex items-start justify-between gap-6 pt-4">
        <div className="min-w-0">
          <h1 className="text-[clamp(3.5rem,8vw,7rem)] font-black leading-[0.9] tracking-[-0.06em] text-[#080B16]">
            뭘 스캔할까요?
          </h1>
        </div>
        <div className="shrink-0">
          <PixelGoose mood="idle" size={92} />
        </div>
      </header>

      <section className="space-y-4 pt-12">
        <div className="text-sm text-neutral-500">프로젝트</div>

        {isLoading ? (
          <div className="bg-white px-5 py-4 text-sm text-neutral-500">프로젝트 목록을 불러오는 중입니다.</div>
        ) : loadError ? (
          <PageBanner message={loadError} tone="error" />
        ) : (
          <div className="flex flex-wrap items-stretch gap-3">
            {projects.map((project) => {
              const isSelected = project.id === selectedProjectId;

              return (
                <button
                  className={`inline-flex min-h-[98px] min-w-[260px] items-center gap-3 px-8 text-left text-base font-black transition ${
                    isSelected ? 'bg-[#111111] text-white' : 'bg-white text-black hover:bg-neutral-50'
                  }`}
                  key={project.id}
                  onClick={() => {
                    if (isSelected) {
                      navigate(ROUTES.projectDetail.replace(':projectId', project.id));
                      return;
                    }

                    setSelectedProjectId(project.id);
                  }}
                  type="button"
                >
                  <span className="truncate text-[clamp(1.35rem,2vw,1.85rem)]">{project.name}</span>
                  <span className={`shrink-0 text-sm font-bold ${getAgentTone(project, isSelected)}`}>
                    {project.monitorEnabled ? 'Agent 사용' : 'Agent 없음'}
                  </span>
                </button>
              );
            })}

            <button
              className="inline-flex min-h-[98px] min-w-[160px] items-center justify-center gap-2 border border-dashed border-neutral-300 bg-white px-8 text-[1.9rem] font-black text-[#111111] transition hover:border-black"
              onClick={() => setIsCreateOpen(true)}
              type="button"
            >
              <Plus className="h-7 w-7" />
              추가
            </button>
          </div>
        )}

        {selectedProject ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
              onClick={() => navigate(ROUTES.projectDetail.replace(':projectId', selectedProject.id))}
              type="button"
            >
              프로젝트 상세 보기
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
              onClick={() => openDeleteModal({ id: selectedProject.id, name: selectedProject.name })}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
              프로젝트 삭제
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm text-neutral-500">최근 결과</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#080B16]">가장 최근에 완료된 스캔</h2>
          </div>
          <p className="text-sm text-neutral-500">프로젝트별 최신 완료 결과를 바로 열어볼 수 있습니다.</p>
        </div>

        {isLoadingCompletedScans ? (
          <div className="border border-black/5 bg-white px-5 py-4 text-sm text-neutral-500">최신 완료 결과를 불러오는 중입니다.</div>
        ) : completedProjectEntries.length === 0 ? (
          <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-5 py-5 text-sm text-neutral-600">
            아직 완료된 스캔이 없습니다.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {completedProjectEntries.map(({ project, latestCompleted }) => {
              const detailPath = ROUTES.projectDetail.replace(':projectId', project.id);
              const resultPath = ROUTES.resultDetail.replace(':scanId', String(latestCompleted.scan.scanId));

              return (
                <button
                  className="flex flex-col gap-5 border border-black/5 bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-black/15"
                  key={project.id}
                  onClick={() => navigate(resultPath, { state: { projectId: project.id } })}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">Latest Result</div>
                      <h3 className="mt-2 text-2xl font-black tracking-tight text-black">{project.name}</h3>
                    </div>
                    <span className="rounded-full bg-black px-2.5 py-1 text-xs font-bold text-white">Scan #{latestCompleted.scan.scanId}</span>
                  </div>

                  <div className="grid gap-3 text-sm text-neutral-600 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Completed</div>
                      <div className="mt-1 font-semibold text-black">
                        {formatCompactDateTime(latestCompleted.scan.completedAt ?? latestCompleted.scan.requestedAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Mode</div>
                      <div className="mt-1 font-semibold text-black">{getScanModeLabel(latestCompleted.scan.scanMode)}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center bg-[#D4FC64] px-3 py-2 text-sm font-bold text-black">결과 바로 보기</span>
                    <button
                      className="border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-black hover:text-black"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(detailPath);
                      }}
                      type="button"
                    >
                      프로젝트 상세
                    </button>
                    <button
                      className="border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDeleteModal({ id: project.id, name: project.name });
                      }}
                      type="button"
                    >
                      프로젝트 삭제
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-5 text-sm text-neutral-500">스캔 방식 선택</div>
        <div className="grid gap-3 lg:grid-cols-3">
          {modeCards.map((mode) => {
            const Icon = mode.icon;
            const isSelected = mode.id === selectedMode;
            const isAgentDisabled =
              mode.id === 'AGENT' && selectedProject
                ? !selectedProjectScanOptions?.availableScanModes.includes('AGENT')
                : false;

            return (
              <button
                className={`min-h-32 p-8 text-left transition ${
                  isSelected ? 'bg-[#111111] text-white' : 'bg-white text-black hover:bg-neutral-50'
                } ${isAgentDisabled ? 'cursor-not-allowed opacity-40' : ''}`}
                disabled={isAgentDisabled}
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                type="button"
              >
                <div className="flex items-center gap-4">
                  <Icon className="h-7 w-7" />
                  <span className="text-3xl font-black tracking-tight">{mode.title}</span>
                </div>
                <p className={`mt-6 text-sm ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>{mode.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {selectedMode === 'UPLOAD' ? (
          <div
            className={`flex min-h-[360px] flex-col items-center justify-center border-2 border-dashed bg-white px-8 py-12 text-center transition ${
              isDragOver ? 'border-black bg-[#F0FFD0]' : 'border-neutral-200'
            }`}
            onDragLeave={() => setIsDragOver(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragOver(false);
              handleUploadFileChange(Array.from(event.dataTransfer.files));
            }}
          >
            <PixelGoose mood={isDragOver ? 'alert' : 'idle'} size={72} />
            <h2 className="mt-8 text-3xl font-black tracking-tight">파일을 드래그하거나 직접 선택해 업로드하세요</h2>
            <p className="mt-3 text-sm text-neutral-500">
              지원 파일: .env, .env.local, .env.*, Dockerfile, Containerfile, docker-compose*.yml/.yaml, compose*.yml/.yaml
            </p>
            <label className="mt-8 cursor-pointer text-base text-neutral-700 underline underline-offset-4 hover:text-black">
              파일 선택
              <input
                className="sr-only"
                multiple
                onChange={(event) => handleUploadFileChange(Array.from(event.target.files ?? []))}
                type="file"
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-neutral-500">
              <span>파일 {uploadStats.count}/3개</span>
              <span>현재 용량 {formatFileSize(uploadStats.totalBytes)}</span>
              <span>남은 용량 {formatFileSize(uploadStats.remainingBytes)}</span>
            </div>
            {selectedUploadFiles.length > 0 ? (
              <div className="mt-8 flex w-full max-w-xl flex-col gap-3 bg-[#111111] px-4 py-3 text-left text-sm text-white">
                {selectedUploadFiles.map((file) => (
                  <div className="flex items-center justify-between gap-3 font-mono" key={`${file.name}-${file.size}-${file.lastModified}`}>
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-neutral-300">{formatFileSize(file.size)}</span>
                  </div>
                ))}
                <button
                  aria-label="선택한 파일 비우기"
                  className="inline-flex items-center gap-2 self-end text-xs text-neutral-300 hover:text-white"
                  onClick={() => handleUploadFileChange(null)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                  파일 비우기
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="min-h-[360px] bg-white p-10">
            <p className="font-mono text-[11px] tracking-[0.24em] text-neutral-400">{selectedMode}</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight">
              {selectedMode === 'CLI' ? '터미널에서 스캔하고 결과를 올립니다' : 'Agent가 연결된 환경에서 스캔을 시작합니다'}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-7 text-neutral-500">
              원하는 동작을 바로 눌러 시작하세요.
            </p>

            {selectedMode === 'AGENT' && (
              <div className="mt-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">스캔 유형 선택</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className={`border p-4 text-left transition ${
                      selectedAgentScanType === 'PROJECT_FILE'
                        ? 'border-black bg-[#111111] text-white'
                        : 'border-neutral-200 bg-white text-black hover:border-black hover:bg-neutral-50'
                    }`}
                    onClick={() => setSelectedAgentScanType('PROJECT_FILE')}
                    type="button"
                  >
                    <p className="font-black">프로젝트 파일 스캔</p>
                    <p className={`mt-1 text-xs leading-relaxed ${selectedAgentScanType === 'PROJECT_FILE' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                      소스 코드·설정 파일의 취약점을 분석합니다.
                    </p>
                  </button>
                  <button
                    className={`border p-4 text-left transition ${
                      selectedAgentScanType === 'SERVER_AUDIT'
                        ? 'border-black bg-[#111111] text-white'
                        : 'border-neutral-200 bg-white text-black hover:border-black hover:bg-neutral-50'
                    }`}
                    onClick={() => setSelectedAgentScanType('SERVER_AUDIT')}
                    type="button"
                  >
                    <p className="font-black">서버 런타임 점검</p>
                    <p className={`mt-1 text-xs leading-relaxed ${selectedAgentScanType === 'SERVER_AUDIT' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                      실행 중인 서버 환경의 보안 상태를 점검합니다.
                    </p>
                  </button>
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* 스캔 */}
              <button
                className="flex flex-col gap-3 border border-neutral-200 p-6 text-left transition hover:border-black hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isStartingScan || !selectedProject}
                onClick={() => void handleStartScan()}
                type="button"
              >
                <div className="flex h-10 w-10 items-center justify-center bg-black">
                  <ScanSearch className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-black">스캔</p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                    {selectedMode === 'AGENT' ? '연결된 Agent가 서버를 직접 점검합니다.' : '스캔 요청을 서버에 등록합니다.'}
                  </p>
                </div>
              </button>

              {/* 업로드 */}
              <button
                className="flex flex-col gap-3 border border-neutral-200 p-6 text-left transition hover:border-black hover:bg-neutral-50"
                onClick={() => setSelectedMode('UPLOAD')}
                type="button"
              >
                <div className="flex h-10 w-10 items-center justify-center bg-neutral-100">
                  <Upload className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="font-black">업로드</p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">설정 파일을 직접 올려 스캔합니다.</p>
                </div>
              </button>

              {/* 수정 */}
              <button
                className="flex flex-col gap-3 border border-neutral-200 p-6 text-left transition hover:border-black hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!selectedProject || !(selectedProjectId && latestCompletedScans[selectedProjectId])}
                onClick={() => {
                  if (!selectedProjectId) return;
                  const latest = latestCompletedScans[selectedProjectId];
                  if (!latest?.scan?.scanId) return;
                  navigate(ROUTES.resultDetail.replace(':scanId', String(latest.scan.scanId)));
                }}
                type="button"
              >
                <div className="flex h-10 w-10 items-center justify-center bg-neutral-100">
                  <Wrench className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="font-black">수정</p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                    {selectedProject && selectedProjectId && latestCompletedScans[selectedProjectId]
                      ? '최근 스캔 결과에서 패치를 확인하고 적용합니다.'
                      : '완료된 스캔이 없습니다. 먼저 스캔을 실행해 주세요.'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        <aside className="space-y-4">
          <div className="bg-white p-8">
            <Lock className="h-6 w-6" />
            <h3 className="mt-7 text-xl font-black">업로드 전에 한 번 더 확인해 주세요</h3>
            <p className="mt-4 text-sm leading-7 text-neutral-500">
              파일 형식과 프로젝트 선택 상태를 확인한 뒤 스캔을 시작하면 더 안정적으로 결과를 확인할 수 있습니다.
            </p>
          </div>
          <div className="bg-[#111111] p-8 text-white">
            <p className="font-mono text-[11px] tracking-[0.24em] text-[#D4FC64]">예상 결과 확인 시간</p>
            <div className="mt-6 text-5xl font-black tracking-tight">~30초</div>
            <p className="mt-4 text-sm text-neutral-500">파일 업로드 스캔 기준</p>
          </div>
          <button
            className="inline-flex w-full items-center justify-center gap-2 bg-[#D4FC64] px-6 py-4 text-sm font-black text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              isStartingScan ||
              !selectedProject ||
              (selectedMode === 'UPLOAD' && selectedUploadFiles.length === 0)
            }
            onClick={() => void handleStartScan()}
            type="button"
          >
            {isStartingScan
              ? '스캔 요청 중...'
              : !selectedProject
              ? '프로젝트를 먼저 선택해 주세요'
              : selectedMode === 'UPLOAD' && selectedUploadFiles.length === 0
              ? '파일을 선택해 주세요'
              : selectedMode === 'UPLOAD'
              ? `파일 ${selectedUploadFiles.length}개로 스캔 시작`
              : '스캔 요청 보내기'}
            {isStartingScan ? <Clock className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </aside>
      </section>

      {scanError ? <PageBanner message={scanError} tone="error" /> : null}

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
            onUploadFilesChange={handleCreateUploadFileChange}
            selectedUploadFiles={createUploadFiles}
            value={formValues}
          />
        </ModalFrame>
      ) : null}

      {isDeleteModalOpen && targetProject ? (
        <ProjectDeleteModal
          errorMessage={deleteProjectError}
          isDeleting={isDeletingProject}
          onClose={closeDeleteModal}
          onConfirm={() => void confirmDelete()}
          projectName={targetProject.name}
        />
      ) : null}

      <button
        className="fixed bottom-6 right-6 hidden items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-bold text-white shadow-2xl xl:inline-flex"
        onClick={() => setIsCreateOpen(true)}
        type="button"
      >
        <FolderPlus className="h-4 w-4" /> 새 프로젝트 만들기
      </button>
    </section>
  );
}

export default ProjectListPage;
