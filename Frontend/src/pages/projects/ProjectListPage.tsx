import { ArrowRight, Clock, FolderPlus, Lock, Plus, Server, Terminal, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import ModalFrame from '../../components/common/ModalFrame';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { useToast } from '../../features/feedback/useToast';
import { createProject, getProjects } from '../../features/projects/api/projects';
import ProjectCreateForm from '../../features/projects/components/ProjectCreateForm';
import ProjectDeleteModal from '../../features/projects/components/ProjectDeleteModal';
import useProjectDeleteFlow from '../../features/projects/hooks/useProjectDeleteFlow';
import {
  createScanRequest,
  getProjectScans,
  reportUploadedScanResult,
  uploadScanResultFile,
} from '../../features/scans/api/scans';
import { formatCompactDateTime, getScanModeLabel } from '../../features/scans/utils/scanPresentation';
import { SCAN_UPLOAD_FILE_SIZE_LIMIT_MB, validateScanUploadFile } from '../../features/scans/utils/uploadValidation';
import { useProjectStore } from '../../store/projectStore';
import type { CreateProjectFormValues, ProjectSummary } from '../../types/project';
import type { ProjectScanListItemData } from '../../types/scan';

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
  { id: 'UPLOAD', icon: Upload, title: '파일 업로드', description: 'raw 결과 JSON을 업로드해서 바로 스캔을 시작할 수 있습니다.' },
  { id: 'CLI', icon: Terminal, title: 'CLI', description: 'CLI 실행 결과를 업로드하거나 CI 흐름과 연결해 점검을 이어갈 수 있습니다.' },
  { id: 'AGENT', icon: Server, title: 'Agent', description: '설치된 Agent가 연결되어 있으면 원격 점검 흐름을 시작할 수 있습니다.' },
];

function getAgentTone(project: ProjectSummary, isSelected: boolean) {
  if (!project.monitorEnabled) {
    return isSelected ? 'text-neutral-400' : 'text-neutral-500';
  }

  return isSelected ? 'text-[#D4FC64]' : 'text-[#8CC319]';
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
  const [createNotice, setCreateNotice] = useState<{ message: string; tone: 'warning' } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ScanModeOption>('UPLOAD');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [createUploadFile, setCreateUploadFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [formValues, setFormValues] = useState<CreateProjectFormValues>(initialProjectForm);
  const [latestCompletedScans, setLatestCompletedScans] = useState<LatestCompletedScanMap>({});
  const [isLoadingCompletedScans, setIsLoadingCompletedScans] = useState(false);

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
      toast.success(`${project.name} 프로젝트를 삭제했습니다.`);
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
  }, [projects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

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
    setCreateUploadFile(null);
    setCreateError(null);
  };

  const handleUploadFileChange = (file: File | null) => {
    setSelectedUploadFile(file);
    setScanError(file ? validateScanUploadFile(file) : null);
  };

  const handleCreateUploadFileChange = (file: File | null) => {
    setCreateUploadFile(file);
    setCreateError(file ? validateScanUploadFile(file) : null);
  };

  const handleCreateProject = async () => {
    setCreateError(null);
    setCreateNotice(null);

    if (createUploadFile) {
      const validationError = validateScanUploadFile(createUploadFile);

      if (validationError) {
        setCreateError(validationError);
        return;
      }
    }

    setIsCreating(true);

    try {
      const projectData = await createProject(formValues);
      const projectName = formValues.name.trim();
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

      if (createUploadFile) {
        try {
          const scanData = await createScanRequest({
            projectName,
            source: 'CLI',
            scanName: `${projectName} 첫 스캔`,
            includeLogs: false,
          });

          await uploadScanResultFile(scanData.rawUploadUrl, createUploadFile);
          await reportUploadedScanResult(scanData.scanId, createUploadFile);

          navigate(ROUTES.scanDetail.replace(':scanId', String(scanData.scanId)), {
            state: { autoOpenedFromScanRequest: true, projectId: nextProject.id },
          });
          return;
        } catch (error) {
          console.error('Failed to start initial scan after project creation.', error);
          setCreateNotice({
            tone: 'warning',
            message: '프로젝트는 생성되었지만 첫 스캔 시작에는 실패했습니다. 다시 시도해 주세요.',
          });
          return;
        }
      }

      toast.success('프로젝트를 생성했습니다.');
    } catch (error) {
      console.error('Failed to create project.', error);
      setCreateError('프로젝트를 생성하지 못했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartScan = async () => {
    if (!selectedProject) {
      setScanError('프로젝트를 먼저 선택해 주세요.');
      return;
    }

    if (selectedMode === 'UPLOAD') {
      const validationError = validateScanUploadFile(selectedUploadFile);

      if (validationError) {
        setScanError(validationError);
        return;
      }
    }

    setIsStartingScan(true);
    setScanError(null);

    try {
      const scanData = await createScanRequest({
        projectName: selectedProject.name,
        source: selectedMode === 'AGENT' ? undefined : 'CLI',
        scanName: `${selectedProject.name} ${selectedMode} 스캔`,
        includeLogs: false,
      });

      if (selectedMode === 'UPLOAD' && selectedUploadFile) {
        await uploadScanResultFile(scanData.rawUploadUrl, selectedUploadFile);
        await reportUploadedScanResult(scanData.scanId, selectedUploadFile);
      }

      navigate(ROUTES.scanDetail.replace(':scanId', String(scanData.scanId)), {
        state: { autoOpenedFromScanRequest: true, projectId: selectedProject.id },
      });
    } catch (error) {
      console.error('Failed to start scan.', error);
      setScanError('스캔을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsStartingScan(false);
    }
  };

  return (
    <section className="space-y-10">
      <header className="flex items-start justify-between gap-6 pt-4">
        <div className="min-w-0">
          <h1 className="text-[clamp(3.5rem,8vw,7rem)] font-black leading-[0.9] tracking-[-0.06em] text-[#080B16]">뭐 스캔할까요 ?</h1>
        </div>
        <div className="shrink-0">
          <PixelGoose mood="idle" size={92} />
        </div>
      </header>

      {createNotice ? <PageBanner message={createNotice.message} tone={createNotice.tone} /> : null}

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
                    {project.monitorEnabled ? '● Agent' : '○ Agent'}
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
              새로
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
              프로젝트 상세
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
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#080B16]">최근 완료된 스캔</h2>
          </div>
          <p className="text-sm text-neutral-500">완료된 스캔 결과를 바로 확인할 수 있습니다.</p>
        </div>

        {isLoadingCompletedScans ? (
          <div className="border border-black/5 bg-white px-5 py-4 text-sm text-neutral-500">최근 결과를 불러오는 중입니다.</div>
        ) : completedProjectEntries.length === 0 ? (
          <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-5 py-5 text-sm text-neutral-600">
            완료된 스캔이 있는 프로젝트가 아직 없습니다.
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
                    <span className="inline-flex items-center bg-[#D4FC64] px-3 py-2 text-sm font-bold text-black">결과 보러 가기</span>
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
            const isAgentDisabled = mode.id === 'AGENT' && selectedProject ? !selectedProject.monitorEnabled : false;

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
              handleUploadFileChange(event.dataTransfer.files.item(0));
            }}
          >
            <PixelGoose mood={isDragOver ? 'alert' : 'idle'} size={72} />
            <h2 className="mt-8 text-3xl font-black tracking-tight">JSON 파일을 이곳에 올려주세요</h2>
            <p className="mt-3 text-sm text-neutral-500">raw 결과 JSON 1개, 최대 {SCAN_UPLOAD_FILE_SIZE_LIMIT_MB}MB</p>
            <label className="mt-8 cursor-pointer text-base text-neutral-700 underline underline-offset-4 hover:text-black">
              파일 선택
              <input
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => handleUploadFileChange(event.target.files?.item(0) ?? null)}
                type="file"
              />
            </label>
            {selectedUploadFile ? (
              <div className="mt-8 flex items-center gap-3 bg-[#111111] px-4 py-3 text-sm text-white">
                <span className="font-mono">{selectedUploadFile.name}</span>
                <button aria-label="선택한 파일 제거" onClick={() => handleUploadFileChange(null)} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="min-h-[360px] bg-white p-10">
            <p className="font-mono text-[11px] tracking-[0.24em] text-neutral-400">{selectedMode}</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight">
              {selectedMode === 'CLI' ? 'CLI 흐름으로 스캔을 시작합니다.' : 'Agent 연결 상태로 스캔을 시작합니다.'}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-600">
              {selectedMode === 'CLI'
                ? 'CLI 결과 파일을 업로드하거나 자동화된 실행 흐름과 연결해 스캔을 이어갈 수 있습니다.'
                : '프로젝트에 Agent가 연결되어 있으면 원격 점검 흐름을 바로 시작할 수 있습니다.'}
            </p>
            <div className="mt-8 bg-neutral-950 p-5 font-mono text-sm text-[#D4FC64]">
              {selectedMode === 'CLI'
                ? `ssafer run --upload --project ${selectedProject?.name ?? 'project-name'}`
                : `agent dispatch --project ${selectedProject?.name ?? 'project-name'}`}
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
            <p className="font-mono text-[11px] tracking-[0.24em] text-[#D4FC64]">평균 첫 결과 확인</p>
            <div className="mt-6 text-5xl font-black tracking-tight">~30초</div>
            <p className="mt-4 text-sm text-neutral-500">P95 기준</p>
          </div>
          <button
            className="inline-flex w-full items-center justify-center gap-2 bg-[#D4FC64] px-6 py-4 text-sm font-black text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isStartingScan || !selectedProject}
            onClick={() => void handleStartScan()}
            type="button"
          >
            {isStartingScan ? '스캔 시작 중' : selectedMode === 'UPLOAD' ? '파일 업로드 후 스캔 시작' : '스캔 시작하기'}
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
            onUploadFileChange={handleCreateUploadFileChange}
            selectedUploadFile={createUploadFile}
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
        <FolderPlus className="h-4 w-4" /> 프로젝트 만들기
      </button>
    </section>
  );
}

export default ProjectListPage;
