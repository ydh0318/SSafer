import {
  ArrowRight,
  ChevronRight,
  Filter,
  FolderGit2,
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

import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { getProjects } from '../../features/projects/api/projects';
import { getScanSummary } from '../../features/results/api/results';
import { getProjectScans } from '../../features/scans/api/scans';
import type { ProjectListItemData } from '../../types/project';
import type { ProjectScanListItemData, ScanMode, ScanStatus, ScanSummaryData } from '../../types/scan';

type DashboardScan = ProjectScanListItemData & {
  projectId: number;
  projectName: string;
  summary: ScanSummaryData | null;
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
    return '방금';
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

        setErrorMessage(error instanceof Error ? error.message : '대시보드 데이터를 불러오지 못했습니다.');
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
        const matchesSearch =
          searchTerm.trim().length === 0 ||
          scan.projectName.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
          String(scan.scanId).includes(searchTerm.trim());
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

  const displayErrorMessage =
    errorMessage && errorMessage.includes('Authentication is required or token is invalid')
      ? '세션이 만료되었거나 인증 정보가 유효하지 않습니다. 다시 로그인한 뒤 새로고침해 주세요.'
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
      {displayErrorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{displayErrorMessage}</div>
      ) : null}

      <section className="border-b border-neutral-200 pb-12">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-lg text-neutral-700">아직 안 고친 거</p>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div className="theme-accent-card bg-[#D4FC64] px-8 py-4 text-black">
                <span className="text-8xl font-black leading-none tabular-nums text-black md:text-[10rem]">{unresolvedCount}</span>
              </div>
              <div className="pb-2">
                <div className="text-4xl font-black text-neutral-400">개</div>
                <div className="mt-5 font-mono text-xs tracking-[0.32em] text-neutral-500">전 주 대비 -23</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 xl:items-end">
            <PixelGoose mood={totals.critical > 0 ? 'alert' : 'working'} size={116} />
            <p className="max-w-[220px] text-left text-sm leading-7 text-neutral-500 xl:text-right">
              {totals.critical > 0 ? `"Critical ${totals.critical}개부터 보세요. 진짜로."` : '"오늘은 차분합니다. 그래도 최근 스캔은 확인해요."'}
            </p>
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
            <h2 className="text-3xl font-black tracking-tight">최근</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  className="w-full border border-neutral-200 py-2 pl-8 pr-3 text-sm sm:w-56"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="프로젝트명 또는 scanId"
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
                  <option value="ALL">전체</option>
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
                새로 스캔
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="px-6 py-16 text-center text-sm text-neutral-500">데이터를 불러오는 중입니다.</div>
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
                        {scan.status === 'DONE' ? '결과 없음' : '진행 중'}
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
            <div className="text-[11px] font-mono tracking-[0.32em] text-[#D4FC64]">아직 안 고친 거</div>
            <div className="mt-6 text-2xl font-black leading-tight">
              {highlightedScan ? (
                <>
                  {highlightedScan.projectName}에
                  <br />
                  Critical {highlightedScan.summary?.criticalCount ?? 0}개.
                </>
              ) : (
                <>완료된 스캔을 기다리는 중.</>
              )}
            </div>
            <p className="mt-5 text-sm text-neutral-400">어제부터 그대로예요.</p>
            <div className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#D4FC64]">
              지금 보기
              <ArrowRight className="h-4 w-4" />
            </div>
            <PixelGoose className="absolute bottom-8 right-8 opacity-90" mood="alert" size={64} />
          </button>

          <div className="bg-white p-8">
            <div className="text-sm text-neutral-500">Local Agent</div>
            <div className="mt-7 space-y-5 text-sm">
              {[
                { name: 'shopping-mall', online: true },
                { name: 'auth-service', online: true },
                { name: 'admin-dash', online: false },
              ].map((agent) => (
                <div className="flex items-center justify-between" key={agent.name}>
                  <span className="font-mono">{agent.name}</span>
                  <span className={agent.online ? 'font-bold text-[#0A8F4E]' : 'font-bold text-neutral-500'}>
                    {agent.online ? '● 연결됨' : '○ 끊김'}
                  </span>
                </div>
              ))}
            </div>
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
              <div className="font-mono text-[11px] tracking-[0.24em]">오늘의 챌린지</div>
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
