import {
  Activity,
  ChevronRight,
  CircleDot,
  Clock,
  Filter,
  FolderGit2,
  Plus,
  ScanSearch,
  Search,
  Terminal,
  Trophy,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import MetricCard from '../../components/common/MetricCard';
import PageHero from '../../components/common/PageHero';
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

const severityTone = {
  critical: 'red',
  high: 'orange',
  medium: 'amber',
  low: 'sky',
  info: 'plain',
} as const;

const searchableStatuses: ScanStatus[] = [
  'REQUESTED',
  'QUEUED',
  'RUNNING',
  'RAW_UPLOADED',
  'DONE',
  'FAILED',
  'CANCELED',
];

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

  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold tracking-[0.22em] ${className}`}>
      {status}
    </span>
  );
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
      const scanData = await getProjectScans(String(project.projectId), {
        page: 0,
        size: 10,
      });

      return scanData.items.map((scan) => ({
        ...scan,
        projectId: project.projectId,
        projectName: project.name,
      }));
    }),
  );

  const mergedScans = scanLists
    .flat()
    .sort((left, right) => new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime());

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

  const filteredScans = useMemo(() => {
    return scans.filter((scan) => {
      const matchesSearch =
        searchTerm.trim().length === 0 ||
        scan.projectName.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        String(scan.scanId).includes(searchTerm.trim());
      const matchesStatus = statusFilter === 'ALL' || scan.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [scans, searchTerm, statusFilter]);

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

  const recentDoneScan = useMemo(
    () => scans.find((scan) => scan.status === 'DONE'),
    [scans],
  );

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
              전체 히스토리
            </button>
            <button
              className="inline-flex items-center gap-2 bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
              onClick={() => navigate(ROUTES.projects)}
              type="button"
            >
              <Plus className="h-4 w-4" />
              프로젝트 보기
            </button>
          </>
        }
        aside={
          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">RESULT ENTRY</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-black">
                  실제 완료된 스캔으로만 결과를 확인합니다
                </h2>
                <p className="mt-4 text-sm leading-7 text-neutral-600">
                  대시보드에서 더 이상 고정 목업 `scanId`로 이동하지 않습니다. 완료된 실제 스캔이 있을 때만 결과 화면으로 이동합니다.
                </p>
              </div>
              <PixelGoose mood={recentDoneScan ? 'happy' : 'working'} size={88} />
            </div>
            <button
              className="mt-6 inline-flex items-center gap-2 bg-black px-4 py-2 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
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
              가장 최근 결과 보기
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
        description="프로젝트별 최근 스캔과 실제 결과 요약을 기반으로 상태를 확인할 수 있습니다."
        eyebrow="DASHBOARD"
        title={
          <>
            실제 프로젝트와 스캔 기준으로
            <br />
            현재 상태를 한눈에 확인하세요.
          </>
        }
      />

      {errorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard helper="완료된 스캔 요약 기준 전체 CRITICAL 수입니다." label="CRITICAL" tone={severityTone.critical} value={totals.critical} />
        <MetricCard helper="완료된 스캔 요약 기준 전체 HIGH 수입니다." label="HIGH" tone={severityTone.high} value={totals.high} />
        <MetricCard helper="완료된 스캔 요약 기준 전체 MEDIUM 수입니다." label="MEDIUM" tone={severityTone.medium} value={totals.medium} />
        <MetricCard helper="완료된 스캔 요약 기준 전체 LOW 수입니다." label="LOW" tone={severityTone.low} value={totals.low} />
        <MetricCard helper="완료된 스캔 요약 기준 전체 INFO 수입니다." label="INFO" tone={severityTone.info} value={totals.info} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_340px]">
        <div className="border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-black tracking-tight text-black">최근 스캔</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  className="w-full border border-neutral-200 py-2 pl-8 pr-3 text-sm sm:w-56"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="프로젝트명 또는 scanId 검색"
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
            </div>
          </div>

          {isLoading ? (
            <div className="px-6 py-12 text-center text-sm text-neutral-500">대시보드 데이터를 불러오는 중입니다.</div>
          ) : filteredScans.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-neutral-500">표시할 스캔이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-[10px] font-bold tracking-[0.26em] text-neutral-500">
                    <th className="px-6 py-3">프로젝트 / scanId</th>
                    <th className="px-3 py-3">상태</th>
                    <th className="px-3 py-3">scanMode</th>
                    <th className="px-3 py-3">위험도</th>
                    <th className="px-3 py-3">시각</th>
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
                              scanId #{scan.scanId} · projectId #{scan.projectId}
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
                      <td className="px-3 py-4 text-sm text-neutral-500">
                        {formatRelativeDate(scan.completedAt || scan.requestedAt)}
                      </td>
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

        <aside className="space-y-4">
          <article className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-black">
              <ScanSearch className="h-4 w-4" />
              실제 결과 확인 팁
            </div>
            <div className="mt-4 space-y-3 text-sm text-neutral-600">
              <p>결과 API는 보통 `DONE` 상태의 스캔에서 가장 안정적으로 확인할 수 있습니다.</p>
              <p>`RUNNING`, `QUEUED` 상태에서는 결과 요약이나 finding 목록이 아직 비어 있을 수 있습니다.</p>
              <p>가장 정확한 검증은 프로젝트 상세에서 방금 생성한 스캔을 열어 결과까지 따라가는 흐름입니다.</p>
            </div>
          </article>

          <article className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-black">
              <Activity className="h-4 w-4" />
              현재 요약
            </div>
            <div className="mt-4 space-y-3 text-sm text-neutral-600">
              <div className="flex items-center justify-between">
                <span>프로젝트 수</span>
                <span className="font-bold text-black">{projects.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>전체 스캔 수</span>
                <span className="font-bold text-black">{scans.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>완료 스캔 수</span>
                <span className="font-bold text-black">{scans.filter((scan) => scan.status === 'DONE').length}</span>
              </div>
            </div>
          </article>

          <article className="border border-[#ffe066] bg-[#fff9db] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-black">
              <Trophy className="h-4 w-4" />
              결과 확인 추천 경로
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-700">
              프로젝트 상세에서 스캔을 생성한 뒤 `스캔 상세 → 결과 페이지 → finding 상세` 순서로 확인하면 실제 API 흐름 검증이 가장 쉽습니다.
            </p>
            <button
              className="mt-4 w-full bg-black py-2 text-sm font-bold text-white transition hover:bg-neutral-800"
              onClick={() => navigate(ROUTES.projects)}
              type="button"
            >
              프로젝트로 이동
            </button>
          </article>

          <article className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-black">
              <CircleDot className="h-4 w-4" />
              결과 진입 규칙
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              완료된 스캔 행을 누르면 결과 페이지로, 그 외 상태는 스캔 상세 페이지로 이동합니다.
            </p>
          </article>
        </aside>
      </div>
    </section>
  );
}

export default DashboardPage;
