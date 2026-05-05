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
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import MetricCard from '../../components/common/MetricCard';
import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import type { ScanMode, ScanStatus } from '../../types/scan';

type DashboardScan = {
  id: number;
  projectId: number;
  name: string;
  scanMode: ScanMode;
  status: ScanStatus;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  time: string;
};

const scans: DashboardScan[] = [
  { id: 1001, projectId: 101, name: 'shopping-mall-api', scanMode: 'AGENT', status: 'DONE', critical: 2, high: 4, medium: 3, low: 7, info: 1, time: '방금 전' },
  { id: 1002, projectId: 102, name: 'admin-dashboard', scanMode: 'UPLOAD', status: 'DONE', critical: 0, high: 1, medium: 5, low: 4, info: 2, time: '2시간 전' },
  { id: 1003, projectId: 103, name: 'auth-service', scanMode: 'AGENT', status: 'RUNNING', critical: 0, high: 0, medium: 0, low: 0, info: 0, time: '5분 전' },
  { id: 1004, projectId: 101, name: 'shopping-mall-api', scanMode: 'CLI', status: 'DONE', critical: 4, high: 6, medium: 8, low: 12, info: 3, time: '어제' },
  { id: 1005, projectId: 104, name: 'payment-gateway', scanMode: 'UPLOAD', status: 'FAILED', critical: 0, high: 0, medium: 0, low: 0, info: 0, time: '이틀 전' },
  { id: 1006, projectId: 105, name: 'media-uploader', scanMode: 'CLI', status: 'DONE', critical: 1, high: 2, medium: 4, low: 9, info: 1, time: '3일 전' },
];

const severityTone = {
  critical: 'red',
  high: 'orange',
  medium: 'amber',
  low: 'sky',
  info: 'plain',
} as const;

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

function DashboardPage() {
  const navigate = useNavigate();

  const totals = useMemo(
    () =>
      scans.reduce(
        (acc, scan) => ({
          critical: acc.critical + scan.critical,
          high: acc.high + scan.high,
          medium: acc.medium + scan.medium,
          low: acc.low + scan.low,
          info: acc.info + scan.info,
        }),
        { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      ),
    [],
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
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">SSAFE ALERT</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-black">지금 먼저 볼 항목이 있어요.</h2>
                <p className="mt-4 text-sm leading-7 text-neutral-600">
                  <span className="font-bold text-[#ff8a33]">shopping-mall-api</span>의 CRITICAL 2건이 아직 열려 있습니다.
                </p>
              </div>
              <PixelGoose mood="alert" size={88} />
            </div>
            <button
              className="mt-6 inline-flex items-center gap-2 bg-black px-4 py-2 text-sm font-bold text-white transition hover:bg-neutral-800"
              onClick={() => navigate(ROUTES.resultDetail.replace(':scanId', '1001'))}
              type="button"
            >
              결과 보러가기
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
        description="최근 스캔 결과와 우선 대응이 필요한 보안 항목을 한눈에 확인할 수 있습니다."
        eyebrow="DASHBOARD"
        title={
          <>
            전체 스캔 현황과
            <br />
            우선 대응할 항목을 빠르게 봅니다.
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard helper="즉시 확인이 필요한 가장 높은 위험도입니다." label="CRITICAL" tone={severityTone.critical} value={totals.critical} />
        <MetricCard helper="운영 환경 노출 가능성이 높은 항목입니다." label="HIGH" tone={severityTone.high} value={totals.high} />
        <MetricCard helper="기본 설정 품질과 재현성에 관련된 항목입니다." label="MEDIUM" tone={severityTone.medium} value={totals.medium} />
        <MetricCard helper="빠르게 정리해두면 더 안전해지는 항목입니다." label="LOW" tone={severityTone.low} value={totals.low} />
        <MetricCard helper="추가 확인이 필요한 참고성 신호입니다." label="INFO" tone={severityTone.info} value={totals.info} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_340px]">
        <div className="border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-black tracking-tight text-black">최근 스캔</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input className="w-full border border-neutral-200 py-2 pl-8 pr-3 text-sm sm:w-56" placeholder="프로젝트명 검색..." />
              </label>
              <button className="inline-flex items-center justify-center gap-2 border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-[#f5f5f5]" type="button">
                <Filter className="h-3.5 w-3.5" />
                필터
              </button>
            </div>
          </div>

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
                {scans.map((scan) => (
                  <tr
                    className="cursor-pointer border-b border-neutral-100 transition hover:bg-[#f5f5f5]"
                    key={scan.id}
                    onClick={() =>
                      navigate(
                        scan.status === 'DONE'
                          ? ROUTES.resultDetail.replace(':scanId', String(scan.id))
                          : ROUTES.scanDetail.replace(':scanId', String(scan.id)),
                      )
                    }
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FolderGit2 className="h-4 w-4 text-neutral-400" />
                        <div>
                          <div className="font-bold text-black">{scan.name}</div>
                          <div className="text-[11px] font-mono text-neutral-400">scanId #{scan.id} · projectId #{scan.projectId}</div>
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
                      {scan.status === 'DONE' ? (
                        <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
                          {scan.critical > 0 ? <span className="bg-[#e63946] px-1.5 py-0.5 text-white">C{scan.critical}</span> : null}
                          {scan.high > 0 ? <span className="bg-[#ff8a33] px-1.5 py-0.5 text-white">H{scan.high}</span> : null}
                          {scan.medium > 0 ? <span className="bg-[#ffb627] px-1.5 py-0.5 text-black">M{scan.medium}</span> : null}
                          {scan.low > 0 ? <span className="bg-[#3d5afe] px-1.5 py-0.5 text-white">L{scan.low}</span> : null}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-neutral-500">{scan.time}</td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-neutral-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <article className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-black">
              <ScanSearch className="h-4 w-4" />
              Local Agent 상태
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {[
                { name: 'shopping-mall', status: 'ONLINE', task: 'idle' },
                { name: 'auth-service', status: 'ONLINE', task: 'PATCH_APPLY' },
                { name: 'admin-dash', status: 'OFFLINE', task: null },
              ].map((agent) => (
                <div className="flex items-center justify-between" key={agent.name}>
                  <div>
                    <div className="font-mono text-xs text-black">{agent.name}</div>
                    <div className="text-[11px] text-neutral-400">{agent.task ?? 'idle'}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold ${agent.status === 'ONLINE' ? 'text-emerald-600' : 'text-neutral-400'}`}>
                    <CircleDot className="h-3 w-3" />
                    {agent.status}
                  </span>
                </div>
              ))}
            </div>
            <button
              className="mt-4 w-full border-t border-neutral-100 pt-3 text-left text-xs font-semibold text-neutral-500 transition hover:text-black"
              onClick={() => navigate(ROUTES.monitor)}
              type="button"
            >
              모니터링 페이지로 이동 →
            </button>
          </article>

          <article className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-black">
              <Activity className="h-4 w-4" />
              이번 주 활동
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {[3, 2, 5, 0, 8, 4, 1].map((value, index) => (
                <div className="relative aspect-square bg-neutral-100" key={index}>
                  <div className="absolute inset-0 bg-black" style={{ opacity: value / 8 }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-neutral-400">
              <span>월</span>
              <span>화</span>
              <span>수</span>
              <span>목</span>
              <span>금</span>
              <span>토</span>
              <span>일</span>
            </div>
            <div className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
              <div className="flex justify-between">
                <span>총 스캔</span>
                <span className="font-bold text-black">23회</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>RESOLVED</span>
                <span className="font-bold text-emerald-600">14건</span>
              </div>
            </div>
          </article>

          <article className="border border-[#ffe066] bg-[#fff9db] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-black">
              <Trophy className="h-4 w-4" />
              오늘의 챌린지
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-700">안전한 docker-compose 한 줄을 직접 따라 치며 익혀보세요.</p>
            <button
              className="mt-4 w-full bg-black py-2 text-sm font-bold text-white transition hover:bg-neutral-800"
              onClick={() => navigate(ROUTES.typingGame)}
              type="button"
            >
              시작하기
            </button>
          </article>
        </aside>
      </div>
    </section>
  );
}

export default DashboardPage;
