import { AlertTriangle, ArrowRight, ChevronDown, Clock, FolderPlus, ScanSearch, Search, Trash2, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import ModalFrame from '../../components/common/ModalFrame';
import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { useToast } from '../../features/feedback/useToast';
import { createProject } from '../../features/projects/api/projects';
import ProjectCreateForm from '../../features/projects/components/ProjectCreateForm';
import ProjectDeleteModal from '../../features/projects/components/ProjectDeleteModal';
import useProjectDeleteFlow from '../../features/projects/hooks/useProjectDeleteFlow';
import useProjectOverviewData from '../../features/projects/hooks/useProjectOverviewData';
import useProjectSelection from '../../features/projects/hooks/useProjectSelection';
import {
  getProjectScanOptions,
  requestAgentScan,
  requestUploadScan,
} from '../../features/scans/api/scans';
import CliGuideBox from '../../features/scans/components/CliGuideBox';
import EstimatedDurationCard from '../../features/scans/components/EstimatedDurationCard';
import ScanModePicker from '../../features/scans/components/ScanModePicker';
import SecretMaskingCard from '../../features/scans/components/SecretMaskingCard';
import UploadDropZone from '../../features/scans/components/UploadDropZone';
import { getUploadScanToastFeedback, getUploadScanValidationToastMessage } from '../../features/scans/utils/uploadScanFeedback';
import { getScanUploadValidationIssue } from '../../features/scans/utils/uploadValidation';
import { useProjectStore } from '../../store/projectStore';
import type { CreateProjectFormValues, ProjectSummary } from '../../types/project';
import type { AgentStatusResponseData, ProjectScanOptionsData, ScanType } from '../../types/scan';

type ScanModeOption = 'UPLOAD' | 'CLI' | 'AGENT';

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
  if (agentStatus) {
    if (agentStatus.status === 'ONLINE') {
      return {
        label: 'Agent online',
        className: isSelected ? 'text-emerald-300' : 'text-emerald-700',
      };
    }

    if (agentStatus.status === 'ERROR') {
      return {
        label: 'Agent error',
        className: isSelected ? 'text-orange-300' : 'text-orange-500',
      };
    }

    return {
      label: 'Agent offline',
      className: isSelected ? 'text-neutral-400' : 'text-neutral-500',
    };
  }

  if (project.monitorEnabled) {
    return {
      label: 'Agent pending',
      className: isSelected ? 'text-neutral-400' : 'text-neutral-500',
    };
  }

  return {
    label: 'Agent disabled',
    className: isSelected ? 'text-neutral-400' : 'text-neutral-500',
  };
}

function ProjectListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const focusProjectId = (location.state as { focusProjectId?: string } | null)?.focusProjectId;
  const addProject = useProjectStore((state) => state.addProject);
  const toast = useToast();

  const { agentStatusMap, isLoading, latestCompletedScans, loadError, projects } = useProjectOverviewData();
  const {
    filteredProjects,
    isProjectDropdownOpen,
    projectSearchTerm,
    projectSelectRef,
    selectProjectById,
    selectedProjectId,
    setIsProjectDropdownOpen,
    setProjectSearchTerm,
  } = useProjectSelection({ projects, focusProjectId });
  const [selectedProjectScanOptionsState, setSelectedProjectScanOptionsState] = useState<{
    data: ProjectScanOptionsData;
    projectId: string;
  } | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const [createUploadFiles, setCreateUploadFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [formValues, setFormValues] = useState<CreateProjectFormValues>(initialProjectForm);
  const [selectedAgentScanType, setSelectedAgentScanType] = useState<ScanType>('PROJECT_FILE');
  const [modeOverrides, setModeOverrides] = useState<Partial<Record<string, ScanModeOption>>>({});

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
      toast.success(`${project.name} project deleted.`);
    },
  });

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    let isMounted = true;

    const loadScanOptions = async () => {
      try {
        const data = await getProjectScanOptions(selectedProjectId);

        if (isMounted) {
          setSelectedProjectScanOptionsState({
            data,
            projectId: selectedProjectId,
          });
        }
      } catch (error) {
        console.error('Failed to load scan options.', error);

        if (
          isMounted &&
          selectedProjectScanOptionsState?.projectId === selectedProjectId
        ) {
          setSelectedProjectScanOptionsState(null);
        }
      }
    };

    void loadScanOptions();

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId, selectedProjectScanOptionsState?.projectId]);

  const selectedProjectScanOptions =
    selectedProjectScanOptionsState?.projectId === selectedProjectId
      ? selectedProjectScanOptionsState.data
      : null;

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedProjectAgentOnline = selectedProject
    ? agentStatusMap[selectedProject.id]?.status === 'ONLINE'
    : false;
  const selectedProjectAgentAvailable = Boolean(
    selectedProject && selectedProjectScanOptions?.availableScanModes.includes('AGENT') && selectedProjectAgentOnline,
  );

  const selectedMode = useMemo<ScanModeOption>(() => {
    if (!selectedProject) {
      return 'UPLOAD';
    }

    const override = modeOverrides[selectedProject.id];

    if (override === 'CLI') {
      return 'CLI';
    }

    if (override === 'UPLOAD') {
      return 'UPLOAD';
    }

    if (override === 'AGENT') {
      return selectedProjectAgentAvailable ? 'AGENT' : 'UPLOAD';
    }

    if (selectedProjectScanOptions?.defaultScanMode === 'AGENT' && selectedProjectAgentAvailable) {
      return 'AGENT';
    }

    return 'UPLOAD';
  }, [modeOverrides, selectedProject, selectedProjectAgentAvailable, selectedProjectScanOptions]);

  const selectedLatestCompleted = useMemo(
    () => (selectedProjectId ? latestCompletedScans[selectedProjectId] ?? null : null),
    [latestCompletedScans, selectedProjectId],
  );
  const selectedLatestProjectFileScan =
    selectedLatestCompleted && selectedLatestCompleted.scan.scanType !== 'SERVER_AUDIT' ? selectedLatestCompleted : null;
  const canApplyLatestProjectFileScan =
    selectedAgentScanType === 'PROJECT_FILE' && Boolean(selectedLatestProjectFileScan);

  const resetCreateForm = () => {
    setFormValues(initialProjectForm);
    setCreateUploadFiles([]);
    setCreateError(null);
  };

  const handleModeSelect = (mode: ScanModeOption) => {
    if (!selectedProject) {
      return;
    }

    setModeOverrides((current) => ({
      ...current,
      [selectedProject.id]: mode,
    }));
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
      setCreateError('A project with the same name already exists.');
      return;
    }

    if (createUploadFiles.length > 0) {
      const validationIssue = getScanUploadValidationIssue(createUploadFiles);

      if (validationIssue) {
        toast.warning(getUploadScanValidationToastMessage(validationIssue) ?? 'Please check the selected files.', {
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
        description: projectDescription || 'No project description provided yet.',
        defaultScanMode: formValues.defaultScanMode,
        monitorEnabled: formValues.monitorEnabled,
        createdAt: new Date().toISOString(),
      };

      addProject(nextProject);
      selectProjectById(nextProject.id);
      setModeOverrides((current) => ({
        ...current,
        [nextProject.id]: nextProject.defaultScanMode === 'AGENT' ? 'AGENT' : 'UPLOAD',
      }));
      resetCreateForm();
      setIsCreateOpen(false);

      if (createUploadFiles.length > 0) {
        try {
          const scanData = await requestUploadScan({
            projectName,
            scanName: `${projectName} initial scan`,
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

      toast.success('Project created successfully.');
    } catch (error) {
      console.error('Failed to create project.', error);
      setCreateError('Failed to create project.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartScan = async () => {
    if (!selectedProject) {
      setScanError('Select a project first.');
      return;
    }

    if (selectedMode === 'AGENT') {
      const refreshedScanOptions = await getProjectScanOptions(selectedProject.id).catch(() => null);
      const agentAvailable = Boolean(
        refreshedScanOptions?.availableScanModes.includes('AGENT') && selectedProjectAgentOnline,
      );

      if (!agentAvailable) {
        setScanError('Agent scan is not available for this project right now.');
        return;
      }
    }

    if (selectedMode === 'UPLOAD') {
      const validationIssue = getScanUploadValidationIssue(selectedUploadFiles);

      if (validationIssue) {
        toast.warning(getUploadScanValidationToastMessage(validationIssue) ?? 'Please check the selected files.', {
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
          scanName: `${selectedProject.name} upload scan`,
          files: selectedUploadFiles,
        });
      } else if (selectedMode === 'AGENT') {
        scanData = await requestAgentScan(String(selectedProject.id), {
          targetPath: '.',
          scanType: selectedAgentScanType,
          scanName: `${selectedProject.name} agent scan`,
          includeLogs: false,
        });
      } else {
        setScanError('CLI mode is a guide-only mode. Please run the CLI manually.');
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

      setScanError('Failed to start scan.');
    } finally {
      setIsStartingScan(false);
    }
  };

  return (
    <section className="space-y-8">
      <header className="flex items-end justify-between gap-6 pt-2">
        <div className="min-w-0">
          <h1 className="text-4xl font-black leading-[0.95] tracking-[-0.03em] text-[#080B16] md:text-5xl xl:text-6xl">
            {projects.length === 0 ? 'Create your first project' : 'Run a project scan'}
          </h1>
        </div>
        <div className="shrink-0">
          <PixelGoose mood="idle" size={64} />
        </div>
      </header>

      <section className="space-y-3 pt-6">
        {isLoading ? (
          <div className="bg-white px-5 py-4 text-sm text-neutral-500 landing-card-radius">Loading projects...</div>
        ) : loadError ? (
          <PageBanner message={loadError} tone="error" />
        ) : (
          <div className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
            <button
              aria-label="Create project"
              className="flex min-h-[112px] w-full items-center justify-center border border-dashed border-neutral-300 bg-neutral-50 transition landing-card-radius hover:border-black hover:bg-white"
              onClick={() => {
                setIsProjectDropdownOpen(false);
                setProjectSearchTerm('');
                setIsCreateOpen(true);
              }}
              type="button"
            >
              <div className="flex h-14 w-14 items-center justify-center border border-neutral-900 bg-black text-white transition landing-inner-radius hover:scale-[1.03]">
                <FolderPlus className="h-7 w-7" />
              </div>
            </button>

            <div className="relative" ref={projectSelectRef}>
              <button
                className="flex min-h-[112px] w-full items-center justify-between gap-4 border border-neutral-200 bg-white px-6 py-5 text-left transition landing-card-radius hover:border-black"
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                type="button"
              >
                <div className="min-w-0">
                  <p className="truncate text-xl font-black text-black">
                    {selectedProject ? selectedProject.name : 'Select a project'}
                  </p>
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
                        placeholder="Search by name or id"
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

                        return (
                          <button
                            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition ${
                              isSelected ? 'bg-black text-white' : 'text-black hover:bg-neutral-50'
                            }`}
                            key={project.id}
                            onClick={() => {
                              selectProjectById(project.id);
                              setProjectSearchTerm('');
                              setIsProjectDropdownOpen(false);
                            }}
                            type="button"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black">{project.name}</p>
                            </div>
                            <span className={`shrink-0 text-xs font-bold ${agentDisplay.className}`}>{agentDisplay.label}</span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-5 text-center text-sm text-neutral-500">No projects found.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {selectedProject ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3.5 py-1.5 text-xs font-bold text-neutral-700 transition hover:border-black hover:text-black"
              onClick={() => navigate(ROUTES.projectDetail.replace(':projectId', selectedProject.id))}
              type="button"
            >
              Open project
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3.5 py-1.5 text-xs font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
              onClick={() => openDeleteModal({ id: selectedProject.id, name: selectedProject.name })}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
              Delete project
            </button>
          </div>
        ) : null}
      </section>

      <ScanModePicker
        isAgentAvailable={selectedProjectAgentAvailable}
        onSelect={handleModeSelect}
        selectedMode={selectedMode}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] landing-anim">
        {selectedMode === 'UPLOAD' ? (
          <UploadDropZone
            files={selectedUploadFiles}
            isDragOver={isDragOver}
            onFileLimitExceeded={() => {
              toast.warning(getUploadScanValidationToastMessage('FILE_COUNT_EXCEEDED') ?? 'Too many files selected.', {
                durationMs: 3000,
              });
            }}
            onDragStateChange={setIsDragOver}
            onFilesChange={handleUploadFileChange}
          />
        ) : (
          <div className="min-h-[340px] bg-white p-7 landing-card-radius md:p-8">
            {selectedMode === 'CLI' ? (
              <div>
                <CliGuideBox mode="CLI_UPLOAD" />
              </div>
            ) : null}

            {selectedMode === 'AGENT' && (
              <div>
                <div className="mb-4 border border-neutral-200 bg-neutral-50 px-4 py-3 landing-inner-radius">
                  <p className="text-sm font-black text-black">Agent scan</p>
                  <p className="mt-1 text-sm text-neutral-500">Use an online agent to run the scan directly from the workspace.</p>
                </div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">Scan target</p>
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
                    <p className="font-black">Project files</p>
                    <p className={`mt-1 text-xs leading-relaxed ${selectedAgentScanType === 'PROJECT_FILE' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                      Scan source files and config files in the project workspace.
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
                    <p className="font-black">Server audit</p>
                    <p className={`mt-1 text-xs leading-relaxed ${selectedAgentScanType === 'SERVER_AUDIT' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                      Inspect the running server environment and operational settings.
                    </p>
                  </button>
                </div>
                {selectedAgentScanType === 'SERVER_AUDIT' ? (
                  <div className="mt-3 flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900 landing-inner-radius">
                    <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-black text-amber-950">Server audit only supports inspection right now.</p>
                      <p className="mt-1">
                        Auto-fix is disabled for server audit results because operational changes can affect live services.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {selectedMode === 'AGENT' ? (
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    <p className="font-black">Start scan</p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                      Run a new agent scan for this project.
                    </p>
                  </div>
                </button>

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
                    <p className="font-black">Review latest fix</p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                      {selectedAgentScanType === 'SERVER_AUDIT'
                        ? 'Server audit does not provide auto-fix output.'
                        : selectedLatestProjectFileScan
                        ? 'Open the latest project-file scan result.'
                        : 'Run a completed project-file scan first.'}
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
                ? 'Starting scan...'
                : !selectedProject
                ? 'Select a project first'
                : selectedMode === 'UPLOAD' && selectedUploadFiles.length === 0
                ? 'Select files first'
                : selectedMode === 'UPLOAD'
                ? `Start upload scan (${selectedUploadFiles.length})`
                : 'Start agent scan'}
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
