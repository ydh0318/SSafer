import {
  ArrowRight,
  ChevronRight,
  Filter,
  Plus,
  RefreshCw,
  ScanSearch,
  Search,
  Terminal,
  Trophy,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { getProjects } from '../../features/projects/api/projects';
import { getScanSummary } from '../../features/results/api/results';
import { getProjectScans } from '../../features/scans/api/scans';
import ScanTypeBadge from '../../features/scans/components/ScanTypeBadge';
import type { ProjectListItemData } from '../../types/project';
import type { ProjectScanListItemData, ScanMode, ScanStatus, ScanSummaryData } from '../../types/scan';

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

const severityColors = {
  critical: '#E63946',
  high: '#FF8A33',
  medium: '#FFB800',
  low: '#3D5AFE',
  info: '#9CA3AF',
} as const;

const searchableStatuses: ScanStatus[] = ['REQUESTED', 'QUEUED', 'RUNNING', 'RAW_UPLOADED', 'DONE', 'FAILED', 'CANCELED'];

function ScanModeBadge({ scanMode }: { scanMode: ScanMode }) {
  const Icon = scanMode === 'CLI' ? Terminal : scanMode === 'UPLOAD' ? Upload : ScanSearch;

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-neutral-500">
      <Icon className="h-3.5 w-3.5" />
      {scanMode}
    </span>
  );
}

function formatRelativeDate(value: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);

  if (diffMinutes < 1) {
    return '방금 전';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}일 전`;
}

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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectListItemData[]>([]);
  const [scans, setScans] = useState<DashboardScan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ScanStatus>('ALL');

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const projectData = await getProjects({ page: 0, size: 20 });
        const nextProjects = projectData.items;
        const nextScans = await buildDashboardScans(nextProjects);

        if (!isMounted) {
          return;
        }

        setProjects(nextProjects);
        setScans(nextScans);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error('Failed to load dashboard data.', error);
        setErrorMessage(error instanceof Error ? error.message : '대시보드 정보를 불러오지 못했습니다.');
        setProjects([]);
        setScans([]);
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

  const filteredScans = useMemo(
    () =>
      scans.filter((scan) => {
        const query = searchTerm.trim().toLowerCase();
        const matchesSearch = query.length === 0 || scan.projectName.toLowerCase().includes(query) || String(scan.scanId).includes(query);
        const matchesStatus = statusFilter === 'ALL' || scan.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [scans, searchTerm, statusFilter],
  );

  const totals = useMemo(
    () =>
      scans.reduce(
        (acc, scan) => ({
          critical: acc.critical + (scan.summary?.criticalCount ?? 0),
          high: acc.high + (scan.summary?.highCount ?? 0),
          medium: acc.medium + (scan.summary?.mediumCount ?? 0),
          low: acc.low + (scan.summary?.lowCount ?? 0),
          info: acc.info + (scan.summary?.infoCount ?? 0),
        }),
        { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      ),
    [scans],
  );

  const unresolvedCount = totals.critical + totals.high + totals.medium + totals.low + totals.info;
  const recentDoneScan = useMemo(() => scans.find((scan) => scan.status === 'DONE'), [scans]);
  const highlightedScan = useMemo(
    () => scans.find((scan) => (scan.summary?.criticalCount ?? 0) > 0) ?? recentDoneScan,
    [recentDoneScan, scans],
  );
  const monitorProjects = useMemo(() => buildDashboardMonitorProjects(projects), [projects]);

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

      <section className="border-b border-neutral-200 pb-12">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-lg text-neutral-700">현재 열려 있는 취약점 수</p>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div className="theme-accent-card bg-[#D4FC64] px-8 py-4 text-black">
                <span className="text-8xl font-black leading-none tabular-nums text-black md:text-[10rem]">{unresolvedCount}</span>
              </div>
              <div className="pb-2">
                <div className="text-4xl font-black text-neutral-400">건</div>
                <div className="mt-5 font-mono text-xs tracking-[0.32em] text-neutral-500">LIVE SNAPSHOT</div>
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
        <div className="bg-white">
          <div className="flex flex-col gap-4 border-b border-neutral-200 px-6 py-6 md:flex-row md:items-center md:justify-between">
            <h2 className="text-3xl font-black tracking-tight">최근 스캔</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  className="w-full border border-neutral-200 py-2 pl-8 pr-3 text-sm sm:w-56"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="프로젝트 이름 또는 scanId"
                  value={searchTerm}
                />
              </label>
              <label className="inline-flex items-center gap-2 border border-neutral-200 px-3 py-2 text-sm text-neutral-700">
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
              <button
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-black hover:bg-[#F5F5F5]"
                onClick={() => navigate(ROUTES.projects)}
                type="button"
              >
                프로젝트 보기
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="px-6 py-16 text-center text-sm text-neutral-500">대시보드 정보를 불러오는 중입니다.</div>
          ) : filteredScans.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-neutral-500">조건에 맞는 스캔이 없습니다.</div>
          ) : (
            <div>
              {filteredScans.slice(0, 8).map((scan) => (
                <button
                  className="group grid w-full grid-cols-1 gap-3 border-b border-neutral-100 px-6 py-6 text-left transition hover:bg-[#FAFAF7] md:grid-cols-[minmax(0,1fr)_auto_auto]"
                  key={scan.scanId}
                  onClick={() => navigateToScan(scan)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xl font-black">{scan.projectName}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono text-neutral-400">
                      <span>#{scan.scanId}</span>
                      <span>·</span>
                      <ScanModeBadge scanMode={scan.scanMode} />
                      <ScanTypeBadge scanType={scan.scanType} />
                      <span>·</span>
                      <span>{formatRelativeDate(scan.completedAt || scan.requestedAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono md:justify-end">
                    {scan.status === 'DONE' && scan.summary ? (
                      <>
                        {scan.summary.criticalCount > 0 ? <span className="font-bold text-[#E63946]">C{scan.summary.criticalCount}</span> : null}
                        {scan.summary.highCount > 0 ? <span className="font-bold text-[#FF8A33]">H{scan.summary.highCount}</span> : null}
                        {scan.summary.mediumCount > 0 ? <span className="text-neutral-500">M{scan.summary.mediumCount}</span> : null}
                        {scan.summary.lowCount > 0 ? <span className="text-neutral-400">L{scan.summary.lowCount}</span> : null}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-neutral-500">
                        <RefreshCw className={scan.status === 'RUNNING' ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                        {scan.status === 'DONE' ? '요약 대기 중' : '진행 중'}
                      </span>
                    )}
                  </div>

                  <ChevronRight className="hidden h-5 w-5 self-center text-neutral-300 transition group-hover:text-black md:block" />
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <button
            className="relative w-full overflow-hidden bg-[#111111] p-8 text-left text-white"
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

          <div className="bg-white p-8">
            <div className="text-sm text-neutral-500">Local Agent</div>
            {monitorProjects.length === 0 ? (
              <div className="mt-7 rounded-sm border border-dashed border-neutral-200 px-4 py-5 text-sm text-neutral-500">
                모니터링이 활성화된 프로젝트가 없습니다.
              </div>
            ) : (
              <div className="mt-7 space-y-5 text-sm">
                {monitorProjects.map((project) => (
                  <div className="flex items-center justify-between gap-4" key={project.projectId}>
                    <div className="min-w-0">
                      <div className="truncate font-mono">{project.projectName}</div>
                      <div className="mt-1 text-xs text-neutral-400">
                        {project.lastSeenAt ? `최근 확인 ${project.lastSeenAt}` : '연결 상태 API 대기 중'}
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
            className="theme-accent-card flex w-full items-center justify-between bg-[#D4FC64] p-7 text-left text-black"
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
