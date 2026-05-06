import { ArrowRight, Clock, FolderPlus, Lock, Plus, Server, Terminal, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ModalFrame from '../../components/common/ModalFrame';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { createProject, getProjects } from '../../features/projects/api/projects';
import ProjectCreateForm from '../../features/projects/components/ProjectCreateForm';
import { createScanRequest, getProjectScans, reportUploadedScanResult, uploadScanResultFile } from '../../features/scans/api/scans';
import { formatCompactDateTime, getScanModeLabel } from '../../features/scans/utils/scanPresentation';
import { SCAN_UPLOAD_FILE_SIZE_LIMIT_MB, validateScanUploadFile } from '../../features/scans/utils/uploadValidation';
import { useProjectStore } from '../../store/projectStore';
import type { ProjectScanListItemData } from '../../types/scan';
import type { CreateProjectFormValues, ProjectSummary } from '../../types/project';

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
  id: ScanModeOption;
  icon: typeof Upload;
  title: string;
  description: string;
}> = [
  { id: 'UPLOAD', icon: Upload, title: '웹 업로드', description: '파일 끌어다 놓기' },
  { id: 'CLI', icon: Terminal, title: 'CLI', description: '터미널 한 줄로 실행' },
  { id: 'AGENT', icon: Server, title: 'Agent', description: '서버에서 바로 스캔' },
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
      } catch {
        if (!isMounted) {
          return;
        }

        setLatestCompletedScans({});
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

          return {
            project,
            latestCompleted,
          };
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

    const uploadFile = createUploadFile;

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
      const projectName = formValues.name.trim();
      const projectDescription = formValues.description.trim();
      const nextProject: ProjectSummary = {
        id: String(projectData.projectId),
        name: projectName,
        owner: 'MY WORKSPACE',
        scans: 0,
        lastStatus: 'NEW',
        risk: 'LOW',
        description: projectDescription || '설명이 아직 없는 프로젝트입니다.',
        defaultScanMode: formValues.defaultScanMode,
        monitorEnabled: formValues.monitorEnabled,
        createdAt: new Date().toISOString(),
      };

      addProject(nextProject);
      setSelectedProjectId(nextProject.id);
      resetCreateForm();
      setIsCreateOpen(false);

      if (uploadFile) {
        try {
          const scanData = await createScanRequest({
            projectName,
            source: 'CLI',
            scanName: `${projectName} 초기 스캔`,
            includeLogs: false,
          });

          await uploadScanResultFile(scanData.rawUploadUrl, uploadFile);
          await reportUploadedScanResult(scanData.scanId, uploadFile);

          navigate(ROUTES.scanDetail.replace(':scanId', String(scanData.scanId)), {
            state: { projectId: nextProject.id, autoOpenedFromScanRequest: true },
          });
          return;
        } catch (error) {
          setCreateNotice({
            tone: 'warning',
            message:
              error instanceof Error
                ? `프로젝트는 생성됐지만 초기 스캔 시작은 실패했습니다. ${error.message}`
                : '프로젝트는 생성됐지만 초기 스캔 시작은 실패했습니다.',
          });
          return;
        }
      }

      setCreateNotice({ tone: 'success', message: '프로젝트를 만들었습니다.' });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '프로젝트 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartScan = async () => {
    if (!selectedProject) {
      setScanError('스캔할 프로젝트를 먼저 선택해주세요.');
      return;
    }

    const uploadFile = selectedUploadFile;

    if (selectedMode === 'UPLOAD') {
      const validationError = validateScanUploadFile(uploadFile);

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
        source: selectedMode === 'CLI' || selectedMode === 'UPLOAD' ? 'CLI' : undefined,
        scanName: `${selectedProject.name} ${selectedMode} 스캔`,
        includeLogs: false,
      });

      if (selectedMode === 'UPLOAD' && uploadFile) {
        await uploadScanResultFile(scanData.rawUploadUrl, uploadFile);
        await reportUploadedScanResult(scanData.scanId, uploadFile);
      }

      navigate(ROUTES.scanDetail.replace(':scanId', String(scanData.scanId)), {
        state: { projectId: selectedProject.id, autoOpenedFromScanRequest: true },
      });
    } catch (error) {
      setScanError(error instanceof Error ? error.message : '스캔 시작에 실패했습니다.');
    } finally {
      setIsStartingScan(false);
    }
  };

  return (
    <section className="space-y-12">
      <header className="flex items-start justify-between gap-8">
        <div>
          <p className="font-mono text-sm tracking-[0.18em] text-neutral-400">STEP 1 of 2</p>
          <h1 className="mt-7 text-5xl font-black leading-none tracking-[-0.04em] text-[#080B16] md:text-7xl">
            뭐 스캔할까요?
          </h1>
        </div>
        <PixelGoose mood="idle" size={92} />
      </header>

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

      <section>
        <div className="mb-5 text-sm text-neutral-500">프로젝트</div>
        {isLoading ? (
          <div className="bg-white px-5 py-4 text-sm text-neutral-500">프로젝트 목록을 불러오는 중입니다.</div>
        ) : loadError ? (
          <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{loadError}</div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {projects.map((project) => {
              const isSelected = project.id === selectedProjectId;
              const agentLabel = project.monitorEnabled ? '● Agent' : '○ Agent';

              return (
                <button
                  className={`inline-flex min-h-14 items-center gap-3 px-6 text-left text-base font-black transition ${
                    isSelected ? 'bg-[#111111] text-white' : 'bg-white text-black hover:bg-neutral-50'
                  }`}
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  type="button"
                >
                  <span>{project.name}</span>
                  <span
                    className={`text-xs font-bold ${
                      project.monitorEnabled ? (isSelected ? 'text-[#D4FC64]' : 'text-[#74A800]') : 'text-neutral-400'
                    }`}
                  >
                    {agentLabel}
                  </span>
                </button>
              );
            })}
            <button
              className="inline-flex min-h-14 items-center gap-2 border border-dashed border-neutral-300 bg-white px-6 text-base font-black transition hover:border-black"
              onClick={() => setIsCreateOpen(true)}
              type="button"
            >
              <Plus className="h-4 w-4" /> 새로
            </button>
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm text-neutral-500">완료된 스캔</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#080B16]">최근 결과가 있는 프로젝트</h2>
          </div>
          <p className="text-sm text-neutral-500">프로젝트를 누르면 가장 최근에 완료된 결과 화면으로 바로 이동합니다.</p>
        </div>

        {isLoadingCompletedScans ? (
          <div className="theme-dark-soft-card border border-black/5 bg-white px-5 py-4 text-sm text-neutral-500">
            완료된 스캔 목록을 불러오는 중입니다.
          </div>
        ) : completedProjectEntries.length === 0 ? (
          <div className="theme-dark-soft-card border border-dashed border-neutral-300 bg-[#fafafa] px-5 py-5 text-sm text-neutral-600">
            아직 결과 화면으로 연결할 완료 스캔이 없습니다.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {completedProjectEntries.map(({ project, latestCompleted }) => {
              const resultPath = ROUTES.resultDetail.replace(':scanId', String(latestCompleted.scan.scanId));
              const detailPath = ROUTES.projectDetail.replace(':projectId', project.id);

              return (
                <button
                  className="theme-dark-soft-card flex flex-col gap-5 border border-black/5 bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-black/15"
                  key={project.id}
                  onClick={() => navigate(resultPath, { state: { projectId: project.id } })}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">Latest Result</div>
                      <h3 className="mt-2 text-2xl font-black tracking-tight text-black">{project.name}</h3>
                    </div>
                    <span className="rounded-full bg-black px-2.5 py-1 text-xs font-bold text-white">
                      Scan #{latestCompleted.scan.scanId}
                    </span>
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
                    <span className="theme-accent-card inline-flex items-center bg-[#D4FC64] px-3 py-2 text-sm font-bold !text-black">
                      결과 보기
                    </span>
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
                      aria-disabled="true"
                      className="border border-dashed border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-400"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                      title="결과 삭제 API 연결 후 바로 활성화할 버튼입니다."
                      type="button"
                    >
                      결과 삭제 예정
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-5 text-sm text-neutral-500">방식</div>
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
            <h2 className="mt-8 text-3xl font-black tracking-tight">여기로 끌어다 놓으세요</h2>
            <p className="mt-3 text-sm text-neutral-500">raw 결과 JSON 1개, 최대 {SCAN_UPLOAD_FILE_SIZE_LIMIT_MB}MB</p>
            <label className="mt-8 cursor-pointer text-base text-neutral-700 underline underline-offset-4 hover:text-black">
              아니면 직접 고르기
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
                <button aria-label="업로드 파일 제거" onClick={() => handleUploadFileChange(null)} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="min-h-[360px] bg-white p-10">
            <p className="font-mono text-[11px] tracking-[0.24em] text-neutral-400">{selectedMode}</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight">
              {selectedMode === 'CLI' ? '터미널 한 줄로 바로 실행하세요' : 'Agent가 연결된 서버에서 바로 시작합니다'}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-600">
              {selectedMode === 'CLI'
                ? '선택한 프로젝트 이름으로 스캔을 등록하고, 로컬이나 CI 환경에서 raw 결과를 업로드하는 흐름입니다.'
                : '프로젝트에 Agent가 연결되어 있다면 서버에서 바로 스캔을 시작하고 진행 상태를 이어서 볼 수 있습니다.'}
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
            <h3 className="mt-7 text-xl font-black">개인정보 안 새요</h3>
            <p className="mt-4 text-sm leading-7 text-neutral-500">마스킹 후 폐기되고, 마스킹된 값만 분석에 사용됩니다.</p>
          </div>
          <div className="bg-[#111111] p-8 text-white">
            <p className="font-mono text-[11px] tracking-[0.24em] text-[#D4FC64]">예상 시간</p>
            <div className="mt-6 text-5xl font-black tracking-tight">~30초</div>
            <p className="mt-4 text-sm text-neutral-500">P95 기준</p>
          </div>
          <button
            className="theme-accent-card inline-flex w-full items-center justify-center gap-2 bg-[#D4FC64] px-6 py-4 text-sm font-black !text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isStartingScan || !selectedProject}
            onClick={() => void handleStartScan()}
            type="button"
          >
            {isStartingScan ? '스캔 시작 중' : selectedMode === 'UPLOAD' ? '업로드하고 스캔 시작' : '스캔 시작하기'}
            {isStartingScan ? <Clock className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </aside>
      </section>

      {scanError ? <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{scanError}</div> : null}

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
