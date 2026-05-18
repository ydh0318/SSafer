import { ArrowRight, Clock, FolderPlus, Plus, ScanSearch, Trash2, Wrench } from 'lucide-react';
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
        className: isSelected ? 'text-[#D4FC64]' : 'text-[#8CC319]',
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

    // ProjectDetailPage 등에서 focusProjectId state로 넘겨준 경우 우선 적용
    if (focusProjectId && projects.some((project) => project.id === focusProjectId)) {
      setSelectedProjectId((current) => current ?? focusProjectId);
      return;
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, focusProjectId]);

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
        <div className="text-sm text-neutral-500">프로젝트</div>

        {isLoading ? (
          <div className="bg-white px-5 py-4 text-sm text-neutral-500 landing-card-radius">프로젝트 목록을 불러오는 중입니다.</div>
        ) : loadError ? (
          <PageBanner message={loadError} tone="error" />
        ) : (
          <div className="flex flex-wrap items-stretch gap-3">
            {projects.map((project) => {
              const isSelected = project.id === selectedProjectId;

              return (
                <button
                  className={`inline-flex min-h-[72px] min-w-[220px] items-center gap-3 px-6 text-left text-base font-black transition landing-card-radius ${
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
                  <span className="truncate text-lg md:text-xl">{project.name}</span>
                  {(() => {
                    const agentDisplay = getAgentDisplay(project, agentStatusMap[project.id] ?? null, isSelected);
                    return (
                      <span className={`shrink-0 text-sm font-bold ${agentDisplay.className}`}>
                        {agentDisplay.label}
                      </span>
                    );
                  })()}
                </button>
              );
            })}

            <button
              className="inline-flex min-h-[72px] min-w-[120px] items-center justify-center gap-2 border border-dashed border-neutral-300 bg-white px-6 text-xl font-black text-[#111111] transition landing-card-radius hover:border-black"
              onClick={() => setIsCreateOpen(true)}
              type="button"
            >
              <Plus className="h-5 w-5" />
              추가
            </button>
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
            <h2 className="mt-1.5 text-xl font-black tracking-tight text-[#080B16] md:text-2xl">가장 최근에 완료된 스캔</h2>
          </div>
          <p className="text-sm text-neutral-500">프로젝트별 최신 완료 결과를 바로 열어볼 수 있습니다.</p>
        </div>

        {isLoadingCompletedScans ? (
          <div className="border border-black/5 bg-white px-5 py-4 text-sm text-neutral-500 landing-card-radius">최신 완료 결과를 불러오는 중입니다.</div>
        ) : completedProjectEntries.length === 0 ? (
          <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-5 py-5 text-sm text-neutral-600 landing-card-radius">
            아직 완료된 스캔이 없습니다.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {completedProjectEntries.map(({ project, latestCompleted }) => {
              const detailPath = ROUTES.projectDetail.replace(':projectId', project.id);
              const resultPath = ROUTES.resultDetail.replace(':scanId', String(latestCompleted.scan.scanId));

              return (
                <button
                  className="flex flex-col gap-4 border border-black/5 bg-white p-5 text-left transition landing-card-radius hover:-translate-y-0.5 hover:border-black/15 hover:shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
                  key={project.id}
                  onClick={() => navigate(resultPath, { state: { projectId: project.id } })}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Latest Result</div>
                      <h3 className="mt-1.5 text-xl font-black tracking-tight text-black">{project.name}</h3>
                    </div>
                    <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-bold text-white">Scan #{latestCompleted.scan.scanId}</span>
                  </div>

                  <div className="grid gap-3 text-xs text-neutral-600 md:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400">Completed</div>
                      <div className="mt-1 text-sm font-semibold text-black">
                        {formatCompactDateTime(latestCompleted.scan.completedAt ?? latestCompleted.scan.requestedAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400">Mode</div>
                      <div className="mt-1 text-sm font-semibold text-black">{getScanModeLabel(latestCompleted.scan.scanMode)}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center bg-[#D4FC64] px-3 py-1.5 text-xs font-bold text-black landing-inner-radius">결과 바로 보기</span>
                    <button
                      className="border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition landing-inner-radius hover:border-black hover:text-black"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(detailPath);
                      }}
                      type="button"
                    >
                      프로젝트 상세
                    </button>
                    <button
                      className="border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition landing-inner-radius hover:border-rose-300 hover:bg-rose-50"
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

      <ScanModePicker
        isAgentAvailable={
          selectedProject
            ? Boolean(selectedProjectScanOptions?.availableScanModes.includes('AGENT'))
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
              </div>
            )}

            {selectedMode === 'AGENT' ? (
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* 스캔 */}
                <button
                  className="flex flex-col gap-3 border border-neutral-200 p-5 text-left transition landing-inner-radius hover:-translate-y-0.5 hover:border-black hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                  disabled={!selectedProject || !(selectedProjectId && latestCompletedScans[selectedProjectId])}
                  onClick={() => {
                    if (!selectedProjectId) return;
                    const latest = latestCompletedScans[selectedProjectId];
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
                      {selectedProject && selectedProjectId && latestCompletedScans[selectedProjectId]
                        ? '최근 스캔 결과에서 패치를 확인하고 적용합니다.'
                        : '완료된 스캔이 없습니다. 먼저 스캔을 실행해 주세요.'}
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
          {selectedMode !== 'CLI' ? (
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

      <button
        className="fixed bottom-6 right-6 z-20 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-bold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-[#111111]"
        onClick={() => setIsCreateOpen(true)}
        type="button"
      >
        <FolderPlus className="h-4 w-4" /> 새 프로젝트 만들기
      </button>
    </section>
  );
}

export default ProjectListPage;
