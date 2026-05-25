import { ArrowRight, Filter, Search, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import useDashboardData, {
  type DashboardScan,
  getDashboardMonitorLastSeenText,
  getDashboardMonitorStatusClassName,
  getDashboardMonitorStatusLabel,
} from '../../features/dashboard/hooks/useDashboardData';
import ScanTimeline from '../../features/scans/components/ScanTimeline';
import { useAuthStore } from '../../store/authStore';
import type { ScanStatus } from '../../types/scan';

const severityColors = {
  critical: '#E63946',
  high: '#FF8A33',
  medium: '#FFB800',
  low: '#3D5AFE',
  info: '#9CA3AF',
} as const;

function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isGuestSession = user?.role === 'GUEST';
  const {
    displayErrorMessage,
    filteredProjectScans,
    guestBanner,
    highlightedScan,
    isLoading,
    monitorProjects,
    searchTerm,
    searchableStatuses,
    setSearchTerm,
    setStatusFilter,
    statusFilter,
    timelineItems,
    totals,
    unresolvedCount,
  } = useDashboardData(isGuestSession);

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

      {guestBanner ? (
        <div className="border border-neutral-200 bg-[#FAFAF7] px-6 py-5 landing-card-radius">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-black tracking-[0.18em] text-neutral-500">GUEST SESSION</p>
              <p className="text-lg font-bold text-black">{guestBanner.title}</p>
              <p className="text-sm leading-6 text-neutral-600">{guestBanner.description}</p>
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
                <span className="text-8xl font-black leading-none tabular-nums text-black md:text-[10rem]">
                  {unresolvedCount}
                </span>
              </div>
              <div className="pb-2">
                <div className="text-4xl font-black text-neutral-400">건</div>
                <div className="mt-5 font-mono text-xs tracking-[0.32em] text-neutral-500">최신 완료 결과 기준</div>
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
                  <span className="w-fit">현재 치명적인 위험은 보이지 않습니다.</span>
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
          <div className="flex flex-col gap-4 border-b border-neutral-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="shrink-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">
                PROJECT SCANS
              </p>
              <h2 className="mt-1 whitespace-nowrap text-2xl font-black tracking-tight md:text-3xl">최신 스캔</h2>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:flex-nowrap">
              <label className="relative min-w-0 flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  className="w-full border border-neutral-200 py-2 pl-8 pr-3 text-sm sm:w-64 landing-inner-radius"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="프로젝트 이름 또는 scanId"
                  value={searchTerm}
                />
              </label>
              <label className="inline-flex items-center gap-2 border border-neutral-200 px-3 py-2 text-sm text-neutral-700 sm:w-40 landing-inner-radius">
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
                <h3 className="mt-4 text-2xl font-black text-black">
                  게스트 모드에서는 스캔 이력이 영구 저장되지 않습니다.
                </h3>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  체험 업로드는 현재 세션에서만 확인할 수 있습니다. 로그인하면 프로젝트별 스캔 결과를 저장하고,
                  이후에도 계속 추적할 수 있습니다.
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
                items={timelineItems}
                onItemClick={(item) => {
                  const scan = filteredProjectScans.find((projectItem) => projectItem.scan.scanId === item.scanId)?.scan;
                  if (scan) {
                    navigateToScan(scan);
                  }
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
            <p className="mt-5 text-sm text-neutral-400">가장 주목할 결과로 바로 이동합니다.</p>
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
                        {getDashboardMonitorLastSeenText(project)}
                      </div>
                    </div>
                    <span className={getDashboardMonitorStatusClassName(project.status)}>
                      {getDashboardMonitorStatusLabel(project.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              className="mt-7 w-full border-t border-neutral-100 pt-5 text-sm text-neutral-500 hover:text-black"
              onClick={() => navigate(ROUTES.monitor)}
              type="button"
            >
              모니터 페이지 보기
            </button>
          </div>

          <button
            className="theme-accent-card flex w-full items-center justify-between bg-[#D4FC64] p-7 text-left text-black landing-card-radius"
            onClick={() => navigate(ROUTES.typingGame)}
            type="button"
          >
            <div>
              <div className="font-mono text-[11px] tracking-[0.24em]">MINI GAME</div>
              <div className="mt-2 text-lg font-black">USER node 타이핑</div>
            </div>
            <Trophy className="h-6 w-6" />
          </button>
        </aside>
      </div>
    </section>
  );
}

export default DashboardPage;
