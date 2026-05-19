import {
  ArrowRight,
  Filter,
  Search,
  Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { getProjectAgentStatus } from '../../features/agents/api/agents';
import { getProjects } from '../../features/projects/api/projects';
import { getOpenFindingSummary, getScanSummary } from '../../features/results/api/results';
import { getProjectScans } from '../../features/scans/api/scans';
import ScanTimeline from '../../features/scans/components/ScanTimeline';
import { formatDateTime, isTerminalScanStatus } from '../../features/scans/utils/scanPresentation';
import { useAuthStore } from '../../store/authStore';
import type { ProjectListItemData } from '../../types/project';
import type {
  AgentStatusResponseData,
  FindingOpenSummaryData,
  ProjectScanListItemData,
  ScanStatus,
  ScanSummaryData,
} from '../../types/scan';

type DashboardScan = ProjectScanListItemData & {
  projectId: number;
  projectName: string;
  summary: ScanSummaryData | null;
};

type DashboardMonitorStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';

type DashboardMonitorProject = {
  projectId: number;
  projectName: string;
  status: DashboardMonitorStatus;
  lastSeenAt: string | null;
};

type DashboardProjectScan = {
  project: ProjectListItemData;
  scan: DashboardScan;
  scans: DashboardScan[];
};

const severityColors = {
  critical: '#E63946',
  high: '#FF8A33',
  medium: '#FFB800',
  low: '#3D5AFE',
  info: '#9CA3AF',
} as const;

const searchableStatuses: ScanStatus[] = ['REQUESTED', 'QUEUED', 'RUNNING', 'RAW_UPLOADED', 'DONE', 'FAILED', 'CANCELED'];

async function buildDashboardScans(projects: ProjectListItemData[]) {
  const scanLists = await Promise.all(
    projects.map(async (project) => {
      const scanData = await getProjectScans(String(project.projectId), { page: 0, size: 10 });

      return scanData.items.map((scan) => ({
        ...scan,
        projectId: project.projectId,
        projectName: project.name,
      }));
    }),
  );

  const mergedScans = scanLists.flat().sort((left, right) => new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime());

  const summaryEntries = await Promise.all(
    mergedScans
      .filter((scan) => scan.status === 'DONE')
      .map(async (scan) => {
        try {
          const summary = await getScanSummary(scan.scanId);
          return [scan.scanId, summary] as const;
        } catch {
          return [scan.scanId, null] as const;
        }
      }),
  );

  const summaryMap = new Map<number, ScanSummaryData | null>(summaryEntries);

  return mergedScans.map((scan) => ({
    ...scan,
    summary: summaryMap.get(scan.scanId) ?? null,
  }));
}

function buildDashboardMonitorProjects(
  projects: ProjectListItemData[],
  monitorStatuses: Array<{ projectId: number; status: DashboardMonitorStatus; lastSeenAt: string | null }> = [],
) {
  const monitorStatusMap = new Map(monitorStatuses.map((item) => [item.projectId, item]));

  return projects
    .filter((project) => project.monitorEnabled)
    .map<DashboardMonitorProject>((project) => {
      const status = monitorStatusMap.get(project.projectId);

      return {
        projectId: project.projectId,
        projectName: project.name,
        status: status?.status ?? 'UNKNOWN',
        lastSeenAt: status?.lastSeenAt ?? null,
      };
    });
}

function getDashboardMonitorStatusLabel(status: DashboardMonitorStatus) {
  switch (status) {
    case 'ONLINE':
      return '연결됨';
    case 'OFFLINE':
      return '끊김';
    case 'ERROR':
      return '오류';
    case 'UNKNOWN':
    default:
      return '상태 대기';
  }
}

function getDashboardMonitorStatusClassName(status: DashboardMonitorStatus) {
  switch (status) {
    case 'ONLINE':
      return 'font-bold text-[#0A8F4E]';
    case 'ERROR':
      return 'font-bold text-[#E63946]';
    case 'OFFLINE':
    case 'UNKNOWN':
    default:
      return 'font-bold text-neutral-500';
  }
}

function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectListItemData[]>([]);
  const [scans, setScans] = useState<DashboardScan[]>([]);
  const [openSummary, setOpenSummary] = useState<FindingOpenSummaryData | null>(null);
  const [agentStatusMap, setAgentStatusMap] = useState<Record<number, AgentStatusResponseData | null>>({});
  const [isAgentStatusLoaded, setIsAgentStatusLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ScanStatus>('ALL');

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [projectData, nextOpenSummary] = await Promise.all([
          getProjects({ page: 0, size: 20 }),
          getOpenFindingSummary(),
        ]);
        const nextProjects = projectData.items;
        const nextScans = await buildDashboardScans(nextProjects);

        if (!isMounted) {
          return;
        }

        setProjects(nextProjects);
        setScans(nextScans);
        setOpenSummary(nextOpenSummary);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error('Failed to load dashboard data.', error);
        setErrorMessage(error instanceof Error ? error.message : '대시보드 정보를 불러오지 못했습니다.');
        setProjects([]);
        setScans([]);
        setOpenSummary(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const dashboardProjectScans = useMemo<DashboardProjectScan[]>(
    () =>
      projects
        .map((project) => {
          const projectScans = scans.filter((scan) => scan.projectId === project.projectId);
          const representativeScan =
            projectScans.find((scan) => !isTerminalScanStatus(scan.status)) ?? projectScans[0] ?? null;

          if (!representativeScan) {
            return null;
          }

          return {
            project,
            scan: representativeScan,
            scans: projectScans,
          };
        })
        .filter((item): item is DashboardProjectScan => item !== null)
        .sort((left, right) => new Date(right.scan.requestedAt).getTime() - new Date(left.scan.requestedAt).getTime()),
    [projects, scans],
  );

  const filteredProjectScans = useMemo(
    () =>
      dashboardProjectScans.filter(({ project, scan, scans: projectScans }) => {
        const query = searchTerm.trim().toLowerCase();
        const matchesSearch =
          query.length === 0 ||
          project.name.toLowerCase().includes(query) ||
          projectScans.some((projectScan) => String(projectScan.scanId).includes(query));
        const matchesStatus = statusFilter === 'ALL' || scan.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [dashboardProjectScans, searchTerm, statusFilter],
  );

  const latestDoneScansByProject = useMemo(
    () =>
      dashboardProjectScans
        .map(({ scans: projectScans }) => projectScans.find((scan) => scan.status === 'DONE') ?? null)
        .filter((scan): scan is DashboardScan => scan !== null),
    [dashboardProjectScans],
  );

  const totals = useMemo(
    () => ({
      critical: openSummary?.bySeverity.CRITICAL ?? 0,
      high: openSummary?.bySeverity.HIGH ?? 0,
      medium: openSummary?.bySeverity.MEDIUM ?? 0,
      low: openSummary?.bySeverity.LOW ?? 0,
      info: openSummary?.bySeverity.INFO ?? 0,
    }),
    [openSummary],
  );

  const unresolvedCount = openSummary?.openCount ?? 0;
  const recentDoneScan = useMemo(() => latestDoneScansByProject[0] ?? null, [latestDoneScansByProject]);
  const highlightedScan = useMemo(
    () => latestDoneScansByProject.find((scan) => (scan.summary?.criticalCount ?? 0) > 0) ?? recentDoneScan,
    [latestDoneScansByProject, recentDoneScan],
  );
  // 모니터링 활성화된 프로젝트의 실제 Agent 연결 상태를 fetch (ProjectListPage와 동일 패턴).
  // 백엔드 API(`/projects/{id}/agent/status`)는 ONLINE 상태일 때만 데이터를 반환하고
  // OFFLINE/미연결이면 NOT_FOUND를 던지므로 catch해서 null 처리한다.
  const monitoredProjectKey = useMemo(
    () => projects.filter((p) => p.monitorEnabled).map((p) => p.projectId).join(','),
    [projects],
  );
  useEffect(() => {
    const monitored = projects.filter((p) => p.monitorEnabled);
    if (monitored.length === 0) {
      setAgentStatusMap({});
      setIsAgentStatusLoaded(true);
      return;
    }

    let isMounted = true;
    setIsAgentStatusLoaded(false);

    void (async () => {
      const entries = await Promise.all(
        monitored.map(async (project) => {
          const status = await getProjectAgentStatus(String(project.projectId)).catch(() => null);
          return [project.projectId, status] as const;
        }),
      );
      if (isMounted) {
        setAgentStatusMap(Object.fromEntries(entries));
        setIsAgentStatusLoaded(true);
      }
    })();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitoredProjectKey]);

  const monitorProjects = useMemo(() => {
    const monitorStatuses = projects
      .filter((p) => p.monitorEnabled)
      .map((p) => {
        const agentStatus = agentStatusMap[p.projectId] ?? null;
        // 백엔드가 ONLINE 외 케이스를 모두 NOT_FOUND로 응답하므로
        // null === OFFLINE 으로 간주한다 (단, fetch 완료 후에만).
        let status: DashboardMonitorStatus;
        if (!isAgentStatusLoaded) {
          status = 'UNKNOWN';
        } else if (agentStatus?.status === 'ONLINE') {
          status = 'ONLINE';
        } else if (agentStatus?.status === 'ERROR') {
          status = 'ERROR';
        } else {
          status = 'OFFLINE';
        }
        return {
          projectId: p.projectId,
          status,
          lastSeenAt: agentStatus?.lastSeenAt ?? null,
        };
      });
    return buildDashboardMonitorProjects(projects, monitorStatuses);
  }, [projects, agentStatusMap, isAgentStatusLoaded]);
  const isGuestSession = user?.role === 'GUEST';

  const displayErrorMessage =
    errorMessage && errorMessage.includes('Authentication is required or token is invalid')
      ? '로그인이 만료되어 대시보드 정보를 불러오지 못했습니다. 다시 로그인해 주세요.'
      : errorMessage;

  const navigateToScan = (scan: DashboardScan) => {
    navigate(
      scan.status === 'DONE'
        ? ROUTES.resultDetail.replace(':scanId', String(scan.scanId))
        : ROUTES.scanDetail.replace(':scanId', String(scan.scanId)),
      { state: { projectId: String(scan.projectId) } },
    );
  };

  return (
    <section className="space-y-10">
      {displayErrorMessage ? <PageBanner message={displayErrorMessage} tone="error" /> : null}
      {isGuestSession ? (
        <div className="border border-neutral-200 bg-[#FAFAF7] px-6 py-5 landing-card-radius">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-black tracking-[0.18em] text-neutral-500">GUEST SESSION</p>
              <p className="text-lg font-bold text-black">게스트 모드의 스캔 결과와 이력은 세션이 종료되면 저장되지 않습니다.</p>
              <p className="text-sm leading-6 text-neutral-600">로그인하면 프로젝트별 스캔 이력을 계속 보관하고, 이후에도 다시 확인할 수 있습니다.</p>
            </div>
            <button
              className="inline-flex items-center gap-2 self-start border border-black px-4 py-3 text-sm font-bold text-black transition landing-inner-radius hover:bg-black hover:text-white"
              onClick={() => navigate(ROUTES.login)}
              type="button"
            >
              로그인하고 이력 저장하기
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <section className="border-b border-neutral-200 pb-12">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-lg text-neutral-700">조치 필요 취약점</p>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div className="theme-accent-card bg-[#D4FC64] px-8 py-4 text-black landing-inner-radius">
                <span className="text-8xl font-black leading-none tabular-nums text-black md:text-[10rem]">{unresolvedCount}</span>
              </div>
              <div className="pb-2">
                <div className="text-4xl font-black text-neutral-400">건</div>
                <div className="mt-5 font-mono text-xs tracking-[0.32em] text-neutral-500">최신 완료 탐지 기준</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 xl:items-end">
            <PixelGoose mood={totals.critical > 0 ? 'alert' : 'working'} size={116} />
            <div className="flex flex-col text-left text-sm leading-7 text-neutral-500 xl:items-end xl:text-right">
              {totals.critical > 0 ? (
                <>
                  <span className="w-fit">{`Critical ${totals.critical}건이 남아 있습니다.`}</span>
                  <span className="w-fit">우선순위가 높은 스캔부터 확인해 주세요.</span>
                </>
              ) : (
                <>
                  <span className="w-fit">현재 치명적인 이슈는 보이지 않습니다.</span>
                  <span className="w-fit">최근 스캔 결과를 계속 확인해 주세요.</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-neutral-200 pt-8">
          {[
            { label: 'Critical', value: totals.critical, color: severityColors.critical },
            { label: 'High', value: totals.high, color: severityColors.high },
            { label: 'Medium', value: totals.medium, color: severityColors.medium },
            { label: 'Low', value: totals.low, color: severityColors.low },
            { label: 'Info', value: totals.info, color: severityColors.info },
          ].map((item) => (
            <div className="flex items-baseline gap-3" key={item.label}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
              <span className="text-4xl font-black tabular-nums">{item.value}</span>
              <span className="text-sm text-neutral-500">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="overflow-hidden border border-neutral-200 bg-white landing-card-radius">
          <div className="flex flex-col gap-4 border-b border-neutral-200 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="shrink-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">PROJECT SCANS</p>
              <h2 className="mt-1 whitespace-nowrap text-2xl font-black tracking-tight md:text-3xl">프로젝트별 최신 스캔</h2>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center xl:flex-nowrap">
              <label className="relative min-w-0 flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  className="w-full border border-neutral-200 py-2 pl-8 pr-3 text-sm sm:w-72 landing-inner-radius"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="프로젝트 이름 또는 scanId"
                  value={searchTerm}
                />
              </label>
              <label className="inline-flex items-center gap-2 border border-neutral-200 px-3 py-2 text-sm text-neutral-700 sm:w-44 landing-inner-radius">
                <Filter className="h-3.5 w-3.5" />
                <select
                  className="bg-transparent outline-none"
                  onChange={(event) => setStatusFilter(event.target.value as 'ALL' | ScanStatus)}
                  value={statusFilter}
                >
                  <option value="ALL">전체 상태</option>
                  {searchableStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {filteredProjectScans.length === 0 && isGuestSession && !isLoading ? (
            <div className="px-6 py-16">
              <div className="mx-auto max-w-2xl border border-dashed border-neutral-300 bg-[#FCFCF8] px-6 py-10 text-center landing-card-radius">
                <p className="text-sm font-black tracking-[0.18em] text-neutral-500">NO SAVED HISTORY</p>
                <h3 className="mt-4 text-2xl font-black text-black">게스트 모드에서는 스캔 이력이 누적 저장되지 않습니다.</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  체험 업로드는 현재 세션에서만 확인할 수 있습니다. 로그인하면 프로젝트별 스캔 결과를 저장하고 이후에도 계속 추적할 수 있습니다.
                </p>
                <button
                  className="mt-6 inline-flex items-center gap-2 border border-black px-4 py-3 text-sm font-bold text-black transition landing-inner-radius hover:bg-black hover:text-white"
                  onClick={() => navigate(ROUTES.login)}
                  type="button"
                >
                  로그인하고 대시보드 채우기
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-4">
              <ScanTimeline
                emptyMessage="조건에 맞는 스캔이 없습니다."
                getDisplayName={(item) => {
                  const projectItem = filteredProjectScans.find(({ scan }) => scan.scanId === item.scanId);
                  return projectItem?.project.name ?? null;
                }}
                isLoading={isLoading}
                items={filteredProjectScans.slice(0, 8).map(({ scan }) => ({
                  scanId: scan.scanId,
                  status: scan.status,
                  scanMode: scan.scanMode,
                  scanType: scan.scanType,
                  source: scan.source,
                  requestedAt: scan.requestedAt,
                  completedAt: scan.completedAt,
                  projectId: scan.projectId,
                  severity: scan.summary
                    ? {
                        critical: scan.summary.criticalCount,
                        high: scan.summary.highCount,
                        medium: scan.summary.mediumCount,
                        low: scan.summary.lowCount,
                      }
                    : undefined,
                }))}
                onItemClick={(item) => {
                  const scan = filteredProjectScans.find((projectItem) => projectItem.scan.scanId === item.scanId)?.scan;
                  if (scan) navigateToScan(scan);
                }}
                variant="compact"
              />
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <button
            className="relative w-full overflow-hidden bg-[#111111] p-8 text-left text-white landing-card-radius"
            disabled={!highlightedScan}
            onClick={() => {
              if (highlightedScan) {
                navigateToScan(highlightedScan);
              }
            }}
            type="button"
          >
            <div className="text-[11px] font-mono tracking-[0.32em] text-[#D4FC64]">PRIORITY SCAN</div>
            <div className="mt-6 text-2xl font-black leading-tight">
              {highlightedScan ? (
                <>
                  {highlightedScan.projectName}
                  <br />
                  {`Critical ${highlightedScan.summary?.criticalCount ?? 0}건`}
                </>
              ) : (
                <>
                  우선 확인할 스캔이 아직
                  <br />
                  없습니다.
                </>
              )}
            </div>
            <p className="mt-5 text-sm text-neutral-400">가장 시급한 결과로 바로 이동합니다.</p>
            <div className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#D4FC64]">
              결과 보러 가기
              <ArrowRight className="h-4 w-4" />
            </div>
            <PixelGoose className="absolute bottom-8 right-8 opacity-90" mood="alert" size={64} />
          </button>

          <div className="border border-neutral-200 bg-white p-8 landing-card-radius">
            <div className="text-sm text-neutral-500">Local Agent</div>
            {monitorProjects.length === 0 ? (
              <div className="mt-7 border border-dashed border-neutral-200 px-4 py-5 text-sm text-neutral-500 landing-inner-radius">
                모니터링이 활성화된 프로젝트가 없습니다.
              </div>
            ) : (
              <div className="mt-7 space-y-5 text-sm">
                {monitorProjects.map((project) => (
                  <div className="flex items-center justify-between gap-4" key={project.projectId}>
                    <div className="min-w-0">
                      <div className="truncate font-mono">{project.projectName}</div>
                      <div className="mt-1 text-xs text-neutral-400">
                        {project.lastSeenAt
                          ? `최근 확인 ${formatDateTime(project.lastSeenAt)}`
                          : project.status === 'UNKNOWN'
                            ? '연결 상태 확인 중'
                            : '아직 Agent가 연결된 적이 없습니다'}
                      </div>
                    </div>
                    <span className={getDashboardMonitorStatusClassName(project.status)}>{getDashboardMonitorStatusLabel(project.status)}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              className="mt-7 w-full border-t border-neutral-100 pt-5 text-sm text-neutral-500 hover:text-black"
              onClick={() => navigate(ROUTES.monitor)}
              type="button"
            >
              모니터 →
            </button>
          </div>

          <button
            className="theme-accent-card flex w-full items-center justify-between bg-[#D4FC64] p-7 text-left text-black landing-card-radius"
            onClick={() => navigate(ROUTES.typingGame)}
            type="button"
          >
            <div>
              <div className="font-mono text-[11px] tracking-[0.24em]">MINI GAME</div>
              <div className="mt-2 text-lg font-black">USER node 한 줄</div>
            </div>
            <Trophy className="h-6 w-6" />
          </button>
        </aside>
      </div>
    </section>
  );
}

export default DashboardPage;
