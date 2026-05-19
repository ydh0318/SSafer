import { AlertTriangle, ArrowRight, ChevronDown, Clock, FolderPlus, ScanSearch, Search, Trash2, Wrench } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import ModalFrame from '../../components/common/ModalFrame';
import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { getProjectAgentStatus } from '../../features/agents/api/agents';
import { useToast } from '../../features/feedback/useToast';
import { createProject, getProjects } from '../../features/projects/api/projects';
import ProjectCreateForm from '../../features/projects/components/ProjectCreateForm';
import ProjectDeleteModal from '../../features/projects/components/ProjectDeleteModal';
import useProjectDeleteFlow from '../../features/projects/hooks/useProjectDeleteFlow';
import {
  getProjectScanOptions,
  getProjectScans,
  requestAgentScan,
  requestUploadScan,
} from '../../features/scans/api/scans';
import CliGuideBox from '../../features/scans/components/CliGuideBox';
import EstimatedDurationCard from '../../features/scans/components/EstimatedDurationCard';
import ScanModePicker from '../../features/scans/components/ScanModePicker';
import SecretMaskingCard from '../../features/scans/components/SecretMaskingCard';
import UploadDropZone from '../../features/scans/components/UploadDropZone';
import { useScanEventSubscription } from '../../features/scans/hooks/useScanEventSubscription';
import { formatCompactDateTime, getScanModeLabel } from '../../features/scans/utils/scanPresentation';
import { getUploadScanToastFeedback, getUploadScanValidationToastMessage } from '../../features/scans/utils/uploadScanFeedback';
import { getScanUploadValidationIssue } from '../../features/scans/utils/uploadValidation';
import { useProjectStore } from '../../store/projectStore';
import type { CreateProjectFormValues, ProjectSummary } from '../../types/project';
import type { AgentStatusResponseData, ProjectScanListItemData, ProjectScanOptionsData, ScanType } from '../../types/scan';

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

const SELECTED_PROJECT_STORAGE_KEY = 'ssafer:selected-project-id';

function normalizeProjectName(value: string) {
  return value.trim();
}

function getAgentDisplay(
  project: ProjectSummary,
  agentStatus: AgentStatusResponseData | null,
  isSelected: boolean,
) {
  // 실제 agent 상태가 fetch된 경우 우선 사용
  if (agentStatus) {
    if (agentStatus.status === 'ONLINE') {
      return {
        label: 'Agent 연결됨',
        className: isSelected ? 'text-emerald-300' : 'text-emerald-700',
      };
    }
    if (agentStatus.status === 'ERROR') {
      return {
        label: 'Agent 오류',
        className: isSelected ? 'text-orange-300' : 'text-orange-500',
      };
    }
    // OFFLINE — agent는 등록되어 있지만 현재 끊김
    return {
      label: 'Agent 오프라인',
      className: isSelected ? 'text-neutral-400' : 'text-neutral-500',
    };
  }

  // agent 상태 정보가 없음 (미등록이거나 아직 로딩 중) — monitorEnabled 설정으로 fallback
  if (project.monitorEnabled) {
    return {
      label: 'Agent 미연결',
      className: isSelected ? 'text-neutral-400' : 'text-neutral-500',
    };
  }
  return {
    label: 'Agent 없음',
    className: isSelected ? 'text-neutral-400' : 'text-neutral-500',
  };
}

function ProjectListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const focusProjectId = (location.state as { focusProjectId?: string } | null)?.focusProjectId;
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
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
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
  const [agentStatusMap, setAgentStatusMap] = useState<Record<string, AgentStatusResponseData | null>>({});
  const projectSelectRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!isProjectDropdownOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!projectSelectRef.current?.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isProjectDropdownOpen]);

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

  // 프로젝트별 Agent 연결 상태를 병렬로 가져온다 (MonitorPage와 동일한 패턴).
  // 프로젝트 목록이 바뀔 때만 다시 fetch 한다.
  const projectIdsKey = useMemo(() => projects.map((p) => p.id).join(','), [projects]);
  useEffect(() => {
    if (projects.length === 0) {
      setAgentStatusMap({});
      return;
    }

    let isMounted = true;
    const targetProjects = projects.slice();

    void (async () => {
      const entries = await Promise.all(
        targetProjects.map(async (project) => {
          const status = await getProjectAgentStatus(project.id).catch(() => null);
          return [project.id, status] as const;
        }),
      );

      if (isMounted) {
        setAgentStatusMap(Object.fromEntries(entries));
      }
    })();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdsKey]);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    if (focusProjectId && projects.some((project) => project.id === focusProjectId)) {
      setSelectedProjectId(focusProjectId);
      return;
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      const storedProjectId = window.sessionStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
      const nextProjectId =
        storedProjectId && projects.some((project) => project.id === storedProjectId)
          ? storedProjectId
          : projects[0].id;

      setSelectedProjectId(nextProjectId);
    }
  }, [projects, selectedProjectId, focusProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      window.sessionStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, selectedProjectId);
    }
  }, [selectedProjectId]);

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
  const selectedProjectAgentOnline = selectedProject
    ? agentStatusMap[selectedProject.id]?.status === 'ONLINE'
    : false;

  const filteredProjects = useMemo(() => {
    const keyword = projectSearchTerm.trim().toLowerCase();
    if (!keyword) return projects;

    return projects.filter((project) => {
      const name = project.name.toLowerCase();
      const id = project.id.toLowerCase();
      return name.includes(keyword) || id.includes(keyword);
    });
  }, [projectSearchTerm, projects]);

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

  useEffect(() => {
    if (selectedMode === 'AGENT' && selectedProjectScanOptions && !selectedProjectAgentOnline) {
      setSelectedMode('UPLOAD');
    }
  }, [selectedMode, selectedProjectScanOptions, selectedProjectAgentOnline]);

  const selectedLatestCompleted = useMemo(
    () => (selectedProjectId ? latestCompletedScans[selectedProjectId] ?? null : null),
    [latestCompletedScans, selectedProjectId],
  );
  const selectedLatestProjectFileScan =
    selectedLatestCompleted && selectedLatestCompleted.scan.scanType !== 'SERVER_AUDIT' ? selectedLatestCompleted : null;
  const canApplyLatestProjectFileScan = selectedAgentScanType === 'PROJECT_FILE' && Boolean(selectedLatestProjectFileScan);

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

    if (selectedMode === 'AGENT' && (!selectedProjectScanOptions?.availableScanModes.includes('AGENT') || !selectedProjectAgentOnline)) {
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
        setScanError('CLI 방식은 웹에서 스캔 요청을 만들지 않습니다. 아래 안내된 명령어를 터미널에서 실행해 주세요.');
        return;
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
    <section className="space-y-8">
      <header className="flex items-end justify-between gap-6 pt-2">
        <div className="min-w-0">
          <h1 className="text-4xl font-black leading-[0.95] tracking-[-0.03em] text-[#080B16] md:text-5xl xl:text-6xl">
            뭘 스캔할까요?
          </h1>
        </div>
        <div className="shrink-0">
          <PixelGoose mood="idle" size={64} />
        </div>
      </header>

      <section className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-neutral-500">프로젝트</div>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-neutral-800"
            onClick={() => {
              setIsProjectDropdownOpen(false);
              setProjectSearchTerm('');
              setIsCreateOpen(true);
            }}
            type="button"
          >
            <FolderPlus className="h-4 w-4" />
            새 프로젝트 만들기
          </button>
        </div>

        {isLoading ? (
          <div className="bg-white px-5 py-4 text-sm text-neutral-500 landing-card-radius">프로젝트 목록을 불러오는 중입니다.</div>
        ) : loadError ? (
          <PageBanner message={loadError} tone="error" />
        ) : (
          <div className="relative max-w-2xl" ref={projectSelectRef}>
            <button
              className="flex min-h-[76px] w-full items-center justify-between gap-4 border border-neutral-200 bg-white px-5 text-left transition landing-card-radius hover:border-black"
              onClick={() => setIsProjectDropdownOpen((current) => !current)}
              type="button"
            >
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400">Selected Project</p>
                <p className="mt-1 truncate text-xl font-black text-black">
                  {selectedProject ? selectedProject.name : '프로젝트를 선택하세요'}
                </p>
                {selectedProject ? (
                  <p className="mt-1 text-xs font-semibold text-neutral-500">
                    projectId #{selectedProject.id}
                    {selectedProjectId && latestCompletedScans[selectedProjectId]
                      ? ` · 최근 스캔 #${latestCompletedScans[selectedProjectId].scan.scanId}`
                      : ''}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {selectedProject ? (() => {
                  const agentDisplay = getAgentDisplay(selectedProject, agentStatusMap[selectedProject.id] ?? null, true);
                  return <span className={`hidden text-sm font-bold sm:inline ${agentDisplay.className}`}>{agentDisplay.label}</span>;
                })() : null}
                <ChevronDown className={`h-5 w-5 text-neutral-400 transition ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isProjectDropdownOpen ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden border border-neutral-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] landing-card-radius">
                <div className="border-b border-neutral-100 p-3">
                  <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus-within:border-black focus-within:bg-white">
                    <Search className="h-4 w-4 text-neutral-400" />
                    <input
                      autoFocus
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-black outline-none placeholder:text-neutral-400"
                      onChange={(event) => setProjectSearchTerm(event.target.value)}
                      placeholder="프로젝트 이름 또는 ID 검색"
                      type="text"
                      value={projectSearchTerm}
                    />
                  </label>
                </div>

                <div className="max-h-72 overflow-y-auto p-2">
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map((project) => {
                      const isSelected = project.id === selectedProjectId;
                      const agentDisplay = getAgentDisplay(project, agentStatusMap[project.id] ?? null, isSelected);
                      const latest = latestCompletedScans[project.id];

                      return (
                        <button
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition ${
                            isSelected ? 'bg-black text-white' : 'text-black hover:bg-neutral-50'
                          }`}
                          key={project.id}
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setProjectSearchTerm('');
                            setIsProjectDropdownOpen(false);
                          }}
                          type="button"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black">{project.name}</p>
                            <p className={`mt-0.5 text-xs ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>
                              projectId #{project.id}
                              {latest ? ` · 최근 스캔 #${latest.scan.scanId}` : ''}
                            </p>
                          </div>
                          <span className={`shrink-0 text-xs font-bold ${agentDisplay.className}`}>{agentDisplay.label}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-5 text-center text-sm text-neutral-500">검색 결과가 없습니다.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {selectedProject ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3.5 py-1.5 text-xs font-bold text-neutral-700 transition hover:border-black hover:text-black"
              onClick={() => navigate(ROUTES.projectDetail.replace(':projectId', selectedProject.id))}
              type="button"
            >
              프로젝트 상세 보기
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3.5 py-1.5 text-xs font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
              onClick={() => openDeleteModal({ id: selectedProject.id, name: selectedProject.name })}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
              프로젝트 삭제
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm text-neutral-500">최근 결과</div>
            <h2 className="mt-1.5 text-xl font-black tracking-tight text-[#080B16] md:text-2xl">선택한 프로젝트의 최신 완료 스캔</h2>
          </div>
          <p className="text-sm text-neutral-500">현재 선택한 프로젝트의 가장 최근 완료 결과만 보여줍니다.</p>
        </div>

        {isLoadingCompletedScans ? (
          <div className="border border-black/5 bg-white px-5 py-4 text-sm text-neutral-500 landing-card-radius">최신 완료 결과를 불러오는 중입니다.</div>
        ) : !selectedProject ? (
          <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-5 py-5 text-sm text-neutral-600 landing-card-radius">
            먼저 프로젝트를 선택하면 최신 완료 스캔을 확인할 수 있습니다.
          </div>
        ) : !selectedLatestCompleted ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-neutral-300 bg-[#fafafa] px-5 py-5 text-sm text-neutral-600 landing-card-radius">
            <span>선택한 프로젝트에 아직 완료된 스캔이 없습니다.</span>
            <button
              className="rounded-full bg-black px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-800"
              onClick={() => setSelectedMode('UPLOAD')}
              type="button"
            >
              스캔 시작하기
            </button>
          </div>
        ) : (
          <button
            className="flex w-full flex-col gap-4 border border-black/5 bg-white p-5 text-left transition landing-card-radius hover:-translate-y-0.5 hover:border-black/15 hover:shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between"
            onClick={() => navigate(ROUTES.resultDetail.replace(':scanId', String(selectedLatestCompleted.scan.scanId)), {
              state: { projectId: selectedLatestCompleted.projectId },
            })}
            type="button"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Latest Result</div>
              <h3 className="mt-1.5 truncate text-xl font-black tracking-tight text-black">{selectedLatestCompleted.projectName}</h3>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
                <span>
                  <span className="font-bold uppercase tracking-[0.18em] text-neutral-400">Completed</span>{' '}
                  <span className="font-semibold text-black">{formatCompactDateTime(selectedLatestCompleted.scan.completedAt ?? selectedLatestCompleted.scan.requestedAt)}</span>
                </span>
                <span>
                  <span className="font-bold uppercase tracking-[0.18em] text-neutral-400">Mode</span>{' '}
                  <span className="font-semibold text-black">{getScanModeLabel(selectedLatestCompleted.scan.scanMode)}</span>
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-bold text-white">Scan #{selectedLatestCompleted.scan.scanId}</span>
              <span className="inline-flex items-center bg-[#D4FC64] px-3 py-1.5 text-xs font-bold text-black landing-inner-radius">결과 바로 보기</span>
            </div>
          </button>
        )}
      </section>

      <ScanModePicker
        isAgentAvailable={
          selectedProject
            ? Boolean(selectedProjectScanOptions?.availableScanModes.includes('AGENT') && selectedProjectAgentOnline)
            : false
        }
        onSelect={setSelectedMode}
        selectedMode={selectedMode}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] landing-anim">
        {selectedMode === 'UPLOAD' ? (
          <UploadDropZone
            files={selectedUploadFiles}
            isDragOver={isDragOver}
            onFileLimitExceeded={() => {
              toast.warning(getUploadScanValidationToastMessage('FILE_COUNT_EXCEEDED') ?? '파일은 최대 3개까지 업로드할 수 있습니다.', {
                durationMs: 3000,
              });
            }}
            onDragStateChange={setIsDragOver}
            onFilesChange={handleUploadFileChange}
          />
        ) : (
          <div className="min-h-[340px] bg-white p-7 landing-card-radius md:p-8">
            <p className="font-mono text-[11px] tracking-[0.24em] text-neutral-400">{selectedMode}</p>
            <h2 className="mt-3 text-xl font-black tracking-tight md:text-2xl">
              {selectedMode === 'CLI' ? '터미널에서 스캔하고 결과를 올립니다' : 'Agent가 연결된 환경에서 스캔을 시작합니다'}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-7 text-neutral-500">
              {selectedMode === 'CLI'
                ? '웹 버튼으로 실행하지 않고, 아래 명령어를 프로젝트 루트 터미널에서 직접 실행합니다.'
                : 'Agent 스캔은 스캔 실행과 결과 업로드를 한 번에 처리합니다.'}
            </p>

            {selectedMode === 'CLI' ? (
              <div className="mt-7">
                <CliGuideBox mode="CLI_UPLOAD" />
              </div>
            ) : null}

            {selectedMode === 'AGENT' && (
              <div className="mt-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">스캔 유형 선택</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className={`border p-4 text-left transition landing-inner-radius ${
                      selectedAgentScanType === 'PROJECT_FILE'
                        ? 'border-black bg-[#111111] text-white'
                        : 'border-neutral-200 bg-white text-black hover:-translate-y-0.5 hover:border-black hover:bg-neutral-50'
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
                    className={`border p-4 text-left transition landing-inner-radius ${
                      selectedAgentScanType === 'SERVER_AUDIT'
                        ? 'border-black bg-[#111111] text-white'
                        : 'border-neutral-200 bg-white text-black hover:-translate-y-0.5 hover:border-black hover:bg-neutral-50'
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
                {selectedAgentScanType === 'SERVER_AUDIT' ? (
                  <div className="mt-3 flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900 landing-inner-radius">
                    <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-black text-amber-950">Agent 서버 점검은 비대화형으로 실행됩니다.</p>
                      <p className="mt-1">
                        비밀번호 입력이 필요한 sudo 명령은 실행할 수 없어 DOCKER-USER, iptables, 일부 방화벽 상세 점검 결과가 제한될 수 있습니다.
                        더 완전한 점검이 필요하면 서버 터미널에서 <code className="rounded bg-amber-100 px-1 font-mono">ssafer server --upload</code>를 직접 실행하세요.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {selectedMode === 'AGENT' ? (
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* 스캔 */}
                <button
                  className="flex flex-col gap-3 border border-neutral-200 p-5 text-left transition landing-inner-radius hover:-translate-y-0.5 hover:border-black hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isStartingScan || !selectedProject}
                  onClick={() => void handleStartScan()}
                  type="button"
                >
                  <div className="flex h-10 w-10 items-center justify-center bg-black landing-inner-radius">
                    <ScanSearch className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-black">스캔 및 업로드</p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                      연결된 Agent가 현재 환경을 점검하고 결과 JSON 업로드까지 이어서 처리합니다.
                    </p>
                  </div>
                </button>

                {/* 수정 */}
                <button
                  className="flex flex-col gap-3 border border-neutral-200 p-5 text-left transition landing-inner-radius hover:-translate-y-0.5 hover:border-black hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!selectedProject || !canApplyLatestProjectFileScan}
                  onClick={() => {
                    const latest = selectedLatestProjectFileScan;
                    if (!latest?.scan?.scanId) return;
                    navigate(ROUTES.resultDetail.replace(':scanId', String(latest.scan.scanId)));
                  }}
                  type="button"
                >
                  <div className="flex h-10 w-10 items-center justify-center bg-neutral-100 landing-inner-radius">
                    <Wrench className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <p className="font-black">수정</p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                      {selectedAgentScanType === 'SERVER_AUDIT'
                        ? '\uc11c\ubc84 \uc810\uac80\uc740 \uc2e4\ud589 \uc911\uc778 \ud3ec\ud2b8, \ubc29\ud654\ubcbd, SSH, Docker \uc0c1\ud0dc\ucc98\ub7fc \uc6b4\uc601 \ud658\uacbd\uc744 \ud655\uc778\ud569\ub2c8\ub2e4. \uc6d0\uc778\uc774 \uc18c\uc2a4 \ud30c\uc77c, \uc11c\ubc84 \uc124\uc815, \ubc29\ud654\ubcbd \uc911 \uc5b4\ub514\uc778\uc9c0 \ub2e8\uc815\ud558\uae30 \uc5b4\ub824\uc6cc \uc790\ub3d9 \ud328\uce58 \uc2dc \uc11c\ube44\uc2a4 \uc7a5\uc560\uac00 \ub0a0 \uc218 \uc788\uc73c\ubbc0\ub85c, \uc218\uc815 \uae30\ub2a5\uc740 \uc81c\uacf5\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.'
                        : selectedLatestProjectFileScan
                        ? '\ucd5c\uc2e0 \ud504\ub85c\uc81d\ud2b8 \ud30c\uc77c \uc2a4\uce94 \uacb0\uacfc\uc758 \uc218\uc815\uc548\uc744 \ud655\uc778\ud569\ub2c8\ub2e4.'
                        : '\uc644\ub8cc\ub41c \ud504\ub85c\uc81d\ud2b8 \ud30c\uc77c \uc2a4\uce94\uc774 \uc5c6\uc2b5\ub2c8\ub2e4. \uba3c\uc800 \ud504\ub85c\uc81d\ud2b8 \ud30c\uc77c \uc2a4\uce94\uc744 \uc2e4\ud589\ud558\uc138\uc694.'}
                    </p>
                  </div>
                </button>
              </div>
            ) : null}
          </div>
        )}

        <aside className="space-y-4">
          <SecretMaskingCard />
          <EstimatedDurationCard />
          {selectedMode === 'UPLOAD' ? (
            <button
              className="inline-flex w-full items-center justify-center gap-2 bg-[#D4FC64] px-5 py-3.5 text-sm font-black text-black transition landing-inner-radius hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(212,252,100,0.45)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
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
                : 'Agent 스캔 및 업로드 시작'}
              {isStartingScan ? <Clock className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          ) : null}
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

    </section>
  );
}

export default ProjectListPage;
