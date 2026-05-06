import {
  ChevronRight,
  Clock,
  Filter,
  FolderGit2,
  Plus,
  ScanSearch,
  Search,
  Terminal,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import MetricCard from '../../components/common/MetricCard';
import PageHero from '../../components/common/PageHero';
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

const severityTone = {
  critical: 'red',
  high: 'orange',
  medium: 'amber',
  low: 'sky',
  info: 'plain',
} as const;

const searchableStatuses: ScanStatus[] = ['REQUESTED', 'QUEUED', 'RUNNING', 'RAW_UPLOADED', 'DONE', 'FAILED', 'CANCELED'];

function StatusBadge({ status }: { status: ScanStatus }) {
  const className =
    status === 'DONE'
      ? 'bg-emerald-100 text-emerald-900'
      : status === 'RUNNING'
        ? 'bg-black text-white'
        : status === 'FAILED'
          ? 'bg-rose-100 text-rose-800'
          : status === 'QUEUED'
            ? 'bg-amber-100 text-amber-900'
            : 'bg-slate-200 text-slate-700';

  return <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold tracking-[0.22em] ${className}`}>{status}</span>;
}

function ScanModeBadge({ scanMode }: { scanMode: ScanMode }) {
  const Icon = scanMode === 'CLI' ? Terminal : scanMode === 'UPLOAD' ? Upload : ScanSearch;

  return (
    <span className="inline-flex items-center gap-1.5 border border-neutral-200 px-2 py-1 text-[11px] font-mono">
      <Icon className="h-3 w-3" />
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

  const recentDoneScan = useMemo(() => scans.find((scan) => scan.status === 'DONE'), [scans]);

  const displayErrorMessage =
    errorMessage && errorMessage.includes('Authentication is required or token is invalid')
      ? '대시보드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
      : errorMessage;

  return (
    <section className="space-y-8">
      <PageHero
        actions={
          <>
            <button
              className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-4 py-3 text-sm font-bold transition hover:bg-[#f5f5f5]"
              onClick={() => navigate(ROUTES.history)}
              type="button"
            >
              <Clock className="h-4 w-4" />
              히스토리
            </button>
            <button
              className="inline-flex items-center gap-2 bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
              onClick={() => navigate(ROUTES.projects)}
              type="button"
            >
              <Plus className="h-4 w-4" />
              프로젝트
            </button>
            <button
              className="inline-flex items-center gap-2 bg-black px-4 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!recentDoneScan}
              onClick={() => {
                if (!recentDoneScan) {
                  return;
                }

                navigate(ROUTES.resultDetail.replace(':scanId', String(recentDoneScan.scanId)), {
                  state: { projectId: String(recentDoneScan.projectId) },
                });
              }}
              type="button"
            >
              최근 결과
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        }
        description={null}
        eyebrow="DASHBOARD"
        title="대시보드"
      />

      {displayErrorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{displayErrorMessage}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="CRITICAL" tone={severityTone.critical} value={totals.critical} />
        <MetricCard label="HIGH" tone={severityTone.high} value={totals.high} />
        <MetricCard label="MEDIUM" tone={severityTone.medium} value={totals.medium} />
        <MetricCard label="LOW" tone={severityTone.low} value={totals.low} />
        <MetricCard label="INFO" tone={severityTone.info} value={totals.info} />
      </div>

      <div className="border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-black tracking-tight text-black">최근 스캔</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
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
              <select className="bg-transparent outline-none" onChange={(event) => setStatusFilter(event.target.value as 'ALL' | ScanStatus)} value={statusFilter}>
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

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-500">불러오는 중...</div>
        ) : filteredScans.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-500">표시할 스캔이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-[10px] font-bold tracking-[0.26em] text-neutral-500">
                  <th className="px-6 py-3">프로젝트 / scanId</th>
                  <th className="px-3 py-3">상태</th>
                  <th className="px-3 py-3">모드</th>
                  <th className="px-3 py-3">결과</th>
                  <th className="px-3 py-3">시간</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredScans.map((scan) => (
                  <tr
                    className="cursor-pointer border-b border-neutral-100 transition hover:bg-[#f5f5f5]"
                    key={scan.scanId}
                    onClick={() =>
                      navigate(
                        scan.status === 'DONE'
                          ? ROUTES.resultDetail.replace(':scanId', String(scan.scanId))
                          : ROUTES.scanDetail.replace(':scanId', String(scan.scanId)),
                        { state: { projectId: String(scan.projectId) } },
                      )
                    }
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FolderGit2 className="h-4 w-4 text-neutral-400" />
                        <div>
                          <div className="font-bold text-black">{scan.projectName}</div>
                          <div className="text-[11px] font-mono text-neutral-400">
                            scanId #{scan.scanId} / projectId #{scan.projectId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge status={scan.status} />
                    </td>
                    <td className="px-3 py-4">
                      <ScanModeBadge scanMode={scan.scanMode} />
                    </td>
                    <td className="px-3 py-4">
                      {scan.summary ? (
                        <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
                          {scan.summary.criticalCount > 0 ? <span className="bg-[#e63946] px-1.5 py-0.5 text-white">C{scan.summary.criticalCount}</span> : null}
                          {scan.summary.highCount > 0 ? <span className="bg-[#ff8a33] px-1.5 py-0.5 text-white">H{scan.summary.highCount}</span> : null}
                          {scan.summary.mediumCount > 0 ? <span className="bg-[#ffb627] px-1.5 py-0.5 text-black">M{scan.summary.mediumCount}</span> : null}
                          {scan.summary.lowCount > 0 ? <span className="bg-[#3d5afe] px-1.5 py-0.5 text-white">L{scan.summary.lowCount}</span> : null}
                          {scan.summary.infoCount > 0 ? <span className="bg-[#9ca3af] px-1.5 py-0.5 text-white">I{scan.summary.infoCount}</span> : null}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-neutral-500">{formatRelativeDate(scan.completedAt || scan.requestedAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-neutral-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default DashboardPage;
