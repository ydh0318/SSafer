import { ArrowRightLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { hasStoredMemberSession, isStoredGuestSession } from '../../features/auth/utils/session';
import { useToast } from '../../features/feedback/useToast';
import useHistoryCompare from '../../features/history/hooks/useHistoryCompare';
import useHistoryData from '../../features/history/hooks/useHistoryData';
import ScanTimeline from '../../features/scans/components/ScanTimeline';
import { useAuthStore } from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';
import type { ScanCompareFindingData, ScanMode } from '../../types/scan';

function CompareFindingList({
  items,
  emptyMessage,
}: {
  items: ScanCompareFindingData[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-400 landing-inner-radius">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <article
          className="border border-neutral-100 bg-white p-4 landing-inner-radius"
          key={`${item.scanId}-${item.findingId}-${item.comparisonKey}`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-neutral-400">#{item.findingId}</span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">
              {item.severity}
            </span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">
              {item.sourceType}
            </span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">
              {item.category}
            </span>
          </div>
          <h4 className="mt-2 text-sm font-bold text-black">{item.title}</h4>
          <div className="mt-1 font-mono text-[11px] text-neutral-400">
            스캔 #{item.scanId}
            {item.ruleCode ? ` | ${item.ruleCode}` : ''}
            {item.filePath ? ` | ${item.filePath}` : ' | 파일 경로 없음'}
            {item.lineNumber ? ` : ${item.lineNumber}` : ''}
          </div>
        </article>
      ))}
    </div>
  );
}

function normalizeHistoryErrorMessage(errorMessage: string | null) {
  if (!errorMessage) {
    return null;
  }

  const normalizedMessage = errorMessage.toLowerCase();

  if (normalizedMessage.includes('authentication') || normalizedMessage.includes('token is invalid')) {
    return '세션이 만료되었습니다. 다시 로그인해 주세요.';
  }

  if (normalizedMessage.includes('network') || normalizedMessage.includes('fetch')) {
    return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (normalizedMessage.includes('failed to load scan history')) {
    return '스캔 이력을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';
  }

  return errorMessage;
}

function HistoryPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);
  const storedProjects = useProjectStore((state) => state.projects);
  const toast = useToast();

  const isGuestSession = user?.role === 'GUEST' || isStoredGuestSession();
  const hasMemberSession =
    Boolean(refreshToken) || user?.role === 'USER' || user?.role === 'ADMIN' || hasStoredMemberSession();
  const canAccessHistory = isAuthenticated && hasMemberSession && !isGuestSession;

  const {
    deletingScanIds,
    doneHistoryItems,
    errorMessage,
    filterProjectId,
    filterScanMode,
    filterStatus,
    handleDeleteScan,
    handleFilterChange,
    handleRefresh,
    historyData,
    isLoading,
    noticeMessage,
    projectFilterOptions,
    projectNameMap,
    visibleHistoryItems,
  } = useHistoryData(canAccessHistory, storedProjects);

  const {
    comparableTargetItems,
    compareData,
    compareGuideMessage,
    formatScanOptionLabel,
    handleCompare,
    isCompareLoading,
    selectedBaseScan,
    selectedBaseScanId,
    selectedTargetScanId,
    setSelectedBaseScanId,
    setSelectedTargetScanId,
  } = useHistoryCompare({
    doneHistoryItems,
    projectNameMap,
    onError: (message) => {
      toast.error(message, { durationMs: 3500 });
    },
    onWarning: (message) => {
      toast.warning(message, { durationMs: 2500 });
    },
  });

  const displayErrorMessage = normalizeHistoryErrorMessage(errorMessage);

  return (
    <section className="space-y-8">
      <section className="border-b border-neutral-200 pb-12">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-neutral-500">History</p>
            <p className="mt-1 text-lg text-neutral-700">최근 스캔 이력을 확인하고 완료된 실행 결과를 비교해 보세요.</p>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div className="bg-[#D4FC64] px-8 py-4 text-black landing-inner-radius">
                <span className="text-8xl font-black leading-none tabular-nums md:text-[10rem]">
                  {historyData.summary.totalScanCount}
                </span>
              </div>
              <div className="pb-2">
                <div className="text-4xl font-black text-neutral-400">건</div>
                <div className="mt-5 font-mono text-xs tracking-[0.32em] text-neutral-500">SCAN HISTORY</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 xl:items-end">
            <PixelGoose mood={historyData.summary.criticalCount > 0 ? 'alert' : 'working'} size={116} />
            <div className="flex flex-col text-left text-sm leading-7 text-neutral-500 xl:items-end xl:text-right">
              <span className="w-fit">완료된 스캔 이력을 추적하고 시간에 따른 변화를 확인해 보세요.</span>
              <span className="w-fit">프로젝트 파일 비교로 새로 생긴 이슈와 해결된 이슈를 빠르게 찾을 수 있습니다.</span>
            </div>
            {canAccessHistory ? (
              <button
                className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition landing-inner-radius hover:border-black hover:text-black"
                onClick={() => void handleRefresh()}
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                새로고침
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-neutral-200 pt-8">
          {[
            { label: '전체 취약점', value: historyData.summary.totalFindingCount, color: '#111111' },
            { label: 'Critical', value: historyData.summary.criticalCount, color: '#E63946' },
            { label: 'High', value: historyData.summary.highCount, color: '#FF8A33' },
            { label: 'Medium', value: historyData.summary.mediumCount, color: '#FFB627' },
            { label: 'Low', value: historyData.summary.lowCount, color: '#3D5AFE' },
            { label: 'Info', value: historyData.summary.infoCount, color: '#9CA3AF' },
          ].map((stat) => (
            <div className="flex items-baseline gap-3" key={stat.label}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: stat.color }} />
              <span className="text-4xl font-black tabular-nums">{stat.value}</span>
              <span className="text-sm text-neutral-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {!canAccessHistory ? (
        <div className="border border-dashed border-neutral-300 bg-white p-10 landing-card-radius">
          <h2 className="text-3xl font-black tracking-tight text-black">회원 로그인 후 이용할 수 있습니다.</h2>
          <div className="mt-5">
            <button
              className="inline-flex items-center gap-2 bg-black px-5 py-3 text-sm font-bold text-white transition landing-inner-radius hover:bg-neutral-800"
              onClick={() => {
                logout();
                navigate(ROUTES.login);
              }}
              type="button"
            >
              로그인하러 가기
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {displayErrorMessage ? (
            <PageBanner message={displayErrorMessage} tone="error" />
          ) : noticeMessage ? (
            <PageBanner message={noticeMessage} tone="success" />
          ) : null}

          <div className="border border-neutral-100 bg-white px-6 py-6 landing-card-radius">
            <div className="flex flex-col gap-4 border-b border-neutral-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">
                  결과 비교
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-black">스캔 비교</h2>
                <p className="mt-2 text-sm leading-7 text-neutral-500">
                  같은 프로젝트에서 완료된 프로젝트 파일 스캔 2개를 비교할 수 있습니다.
                </p>
                <p className="mt-2 max-w-xl rounded-full bg-neutral-50 px-3 py-1.5 text-xs font-bold text-neutral-500">
                  {visibleHistoryItems.length === 0
                    ? '현재 필터 조건에 맞는 스캔이 없습니다.'
                    : compareGuideMessage}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,220px)_auto]">
                <label className="space-y-1.5">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400">
                    기준 스캔
                  </span>
                  <select
                    className="w-full border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black outline-none transition landing-inner-radius focus:border-black"
                    disabled={doneHistoryItems.length === 0}
                    onChange={(event) => setSelectedBaseScanId(event.target.value)}
                    value={selectedBaseScanId}
                  >
                    <option value="">{doneHistoryItems.length === 0 ? '선택 가능한 스캔 없음' : '스캔 선택'}</option>
                    {doneHistoryItems.map((item) => (
                      <option key={`base-${item.scanId}`} value={item.scanId}>
                        {formatScanOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400">
                    비교 스캔
                  </span>
                  <select
                    className="w-full border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black outline-none transition landing-inner-radius focus:border-black"
                    disabled={!selectedBaseScan || comparableTargetItems.length === 0}
                    onChange={(event) => setSelectedTargetScanId(event.target.value)}
                    value={selectedTargetScanId}
                  >
                    <option value="">
                      {!selectedBaseScan
                        ? '기준 스캔을 먼저 선택해 주세요'
                        : comparableTargetItems.length === 0
                          ? '선택 가능한 스캔 없음'
                          : '스캔 선택'}
                    </option>
                    {comparableTargetItems.map((item) => (
                      <option
                        disabled={String(item.scanId) === selectedBaseScanId}
                        key={`target-${item.scanId}`}
                        value={item.scanId}
                      >
                        {formatScanOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="mt-auto inline-flex items-center justify-center gap-2 bg-black px-4 py-2.5 text-sm font-bold text-white transition landing-inner-radius hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                  disabled={
                    isCompareLoading ||
                    doneHistoryItems.length < 2 ||
                    comparableTargetItems.length < 1 ||
                    selectedBaseScanId === '' ||
                    selectedTargetScanId === '' ||
                    selectedBaseScanId === selectedTargetScanId
                  }
                  onClick={() => void handleCompare()}
                  type="button"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  {isCompareLoading ? '비교 중...' : '비교하기'}
                </button>
              </div>
            </div>

            {compareData ? (
              <div className="mt-6 space-y-6">
                <div className="flex flex-wrap items-center gap-x-10 gap-y-4 border-b border-neutral-100 pb-6">
                  {[
                    { label: '신규', value: compareData.summary.newCount, color: '#E63946' },
                    { label: '해결', value: compareData.summary.resolvedCount, color: '#9FCC2E' },
                    { label: '유지', value: compareData.summary.retainedCount, color: '#9CA3AF' },
                    {
                      label: '심각도 변경',
                      value: compareData.summary.severityChangedCount,
                      color: '#FF8A33',
                    },
                  ].map((stat) => (
                    <div className="flex items-baseline gap-3" key={stat.label}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: stat.color }} />
                      <span className="text-3xl font-black tabular-nums">{stat.value}</span>
                      <span className="text-sm text-neutral-500">{stat.label}</span>
                    </div>
                  ))}
                  <div className="ml-auto flex items-center gap-6 font-mono text-xs text-neutral-400">
                    <span>
                      기준 <span className="font-bold text-black">#{compareData.baseScanId}</span>
                    </span>
                    <span>대비</span>
                    <span>
                      비교 <span className="font-bold text-black">#{compareData.targetScanId}</span>
                    </span>
                    <span className="text-neutral-300">|</span>
                    <span>
                      {compareData.summary.baseFindingCount}건 대비 {compareData.summary.targetFindingCount}건
                    </span>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">
                      신규 취약점
                    </p>
                    <CompareFindingList
                      emptyMessage="새롭게 추가된 취약점이 없습니다."
                      items={compareData.newFindings}
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">
                      해결된 취약점
                    </p>
                    <CompareFindingList
                      emptyMessage="해결된 취약점이 없습니다."
                      items={compareData.resolvedFindings}
                    />
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">
                      유지된 취약점
                    </p>
                    <CompareFindingList
                      emptyMessage="계속 유지되는 취약점이 없습니다."
                      items={compareData.retainedFindings}
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">
                      심각도 변경
                    </p>
                    {compareData.severityChangedFindings.length === 0 ? (
                      <div className="border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-400 landing-inner-radius">
                        심각도가 변경된 취약점이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {compareData.severityChangedFindings.map((item) => (
                          <article
                            className="border border-neutral-100 bg-white p-4 landing-inner-radius"
                            key={`${item.baseFinding.findingId}-${item.targetFinding.findingId}`}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-neutral-400">
                                #{item.targetFinding.findingId}
                              </span>
                              <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">
                                {item.baseSeverity} {'->'} {item.targetSeverity}
                              </span>
                            </div>
                            <h4 className="mt-2 text-sm font-bold text-black">{item.targetFinding.title}</h4>
                            <div className="mt-1 font-mono text-[11px] text-neutral-400">
                              기준 #{item.baseFinding.scanId} | 비교 #{item.targetFinding.scanId}
                              {item.targetFinding.ruleCode ? ` | ${item.targetFinding.ruleCode}` : ''}
                              {item.targetFinding.filePath ? ` | ${item.targetFinding.filePath}` : ''}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-black tracking-tight md:text-2xl">스캔 이력</h2>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                    프로젝트
                  </span>
                  <select
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-600 outline-none transition hover:border-neutral-400 focus:border-black"
                    onChange={(event) => handleFilterChange(filterScanMode, filterStatus, event.target.value)}
                    value={filterProjectId}
                  >
                    <option value="">전체</option>
                    {projectFilterOptions.map((project) => (
                      <option key={project.projectId} value={project.projectId}>
                        {project.projectName}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                    방식
                  </span>
                  <div className="flex gap-1">
                    {([
                      { value: '' as const, label: '전체' },
                      { value: 'UPLOAD' as const, label: '업로드' },
                      { value: 'AGENT' as const, label: '에이전트' },
                    ] satisfies { value: ScanMode | ''; label: string }[]).map((option) => (
                      <button
                        className={`px-2.5 py-1 text-xs font-bold transition landing-inner-radius ${
                          filterScanMode === option.value
                            ? 'bg-black text-white'
                            : 'border border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400 hover:text-black'
                        }`}
                        key={option.value || 'all-mode'}
                        onClick={() => handleFilterChange(option.value, filterStatus)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                    결과
                  </span>
                  <div className="flex gap-1">
                    {([
                      { value: '' as const, label: '전체' },
                      { value: 'DONE' as const, label: '완료' },
                      { value: 'FAILED' as const, label: '실패' },
                    ] satisfies { value: 'DONE' | 'FAILED' | ''; label: string }[]).map((option) => (
                      <button
                        className={`px-2.5 py-1 text-xs font-bold transition landing-inner-radius ${
                          filterStatus === option.value
                            ? 'bg-black text-white'
                            : 'border border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400 hover:text-black'
                        }`}
                        key={option.value || 'all-status'}
                        onClick={() => handleFilterChange(filterScanMode, option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <ScanTimeline
              deletingScanIds={deletingScanIds}
              emptyMessage="아직 스캔 이력이 없습니다."
              isLoading={isLoading}
              items={visibleHistoryItems.map((item) => ({
                scanId: item.scanId,
                status: item.status,
                scanMode: item.scanMode,
                scanType: item.scanType,
                source: item.source,
                requestedAt: item.requestedAt,
                completedAt: item.completedAt,
                projectId: item.projectId,
                projectName: projectNameMap[item.projectId],
                severity: {
                  critical: item.criticalCount,
                  high: item.highCount,
                  medium: item.mediumCount,
                  low: item.lowCount,
                },
              }))}
              onDeleteScan={(scanId) => void handleDeleteScan(scanId)}
              showProjectChip
            />
          </section>
        </div>
      )}
    </section>
  );
}

export default HistoryPage;
