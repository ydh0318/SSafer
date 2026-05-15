import { ArrowRightLeft, ChevronRight, RefreshCw, ScanSearch, Terminal, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { hasStoredMemberSession, isStoredGuestSession } from '../../features/auth/utils/session';
import { getHistoryScans } from '../../features/history/api/history';
import { getScanCompare } from '../../features/results/api/results';
import { deleteScanHistory } from '../../features/scans/api/scans';
import ScanTypeBadge from '../../features/scans/components/ScanTypeBadge';
import { useScanEventSubscription } from '../../features/scans/hooks/useScanEventSubscription';
import {
  canDeleteScanHistory,
  formatDateTime,
  getDeleteBlockedReason,
  getScanModeLabel,
  getSafeScanType,
} from '../../features/scans/utils/scanPresentation';
import { useAuthStore } from '../../store/authStore';
import type {
  HistoryScanListItemData,
  HistoryScanListResponseData,
  ScanCompareFindingData,
  ScanCompareResponseData,
  ScanMode,
  ScanStatus,
} from '../../types/scan';

const HISTORY_PAGE_SIZE = 10;

const emptyHistoryData: HistoryScanListResponseData = {
  summary: {
    totalScanCount: 0,
    totalFindingCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
  },
  items: [],
  page: 0,
  size: HISTORY_PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
};

function getScanStatusBarClass(status: ScanStatus) {
  if (status === 'DONE') return 'bg-[#9FCC2E]';
  if (['RUNNING', 'QUEUED', 'REQUESTED', 'RAW_UPLOADED'].includes(status)) return 'bg-neutral-400';
  if (status === 'FAILED') return 'bg-rose-400';
  return 'bg-neutral-200';
}

function getScanStatusChipClass(status: ScanStatus) {
  if (status === 'DONE') return 'bg-[#EDFFC0] text-[#4A7A00]';
  if (status === 'RUNNING' || status === 'RAW_UPLOADED') return 'bg-neutral-200 text-neutral-600';
  if (status === 'QUEUED' || status === 'REQUESTED') return 'bg-neutral-100 text-neutral-500';
  if (status === 'FAILED') return 'bg-rose-50 text-rose-600';
  if (status === 'CANCELED') return 'bg-neutral-100 text-neutral-400';
  return 'bg-neutral-100 text-neutral-500';
}

const severityPills = [
  { key: 'critical' as const, label: 'C', countKey: 'criticalCount' as const, cls: 'border-red-200 bg-red-50 text-red-700',    dot: 'bg-red-500'    },
  { key: 'high'     as const, label: 'H', countKey: 'highCount'     as const, cls: 'border-orange-200 bg-orange-50 text-orange-700', dot: 'bg-orange-400' },
  { key: 'medium'   as const, label: 'M', countKey: 'mediumCount'   as const, cls: 'border-yellow-200 bg-yellow-50 text-yellow-700', dot: 'bg-yellow-400' },
  { key: 'low'      as const, label: 'L', countKey: 'lowCount'      as const, cls: 'border-blue-200 bg-blue-50 text-blue-600',   dot: 'bg-blue-400'   },
] as const;

function ScanModeBadge({ scanMode, source }: { scanMode: ScanMode; source?: string | null }) {
  const Icon = scanMode === 'CLI' ? Terminal : scanMode === 'UPLOAD' ? Upload : ScanSearch;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">
      <Icon className="h-3 w-3" />
      {getScanModeLabel(scanMode, source)}
    </span>
  );
}

function CompareFindingList({ items, emptyMessage }: { items: ScanCompareFindingData[]; emptyMessage: string }) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <article className="border border-neutral-100 bg-white p-4" key={`${item.scanId}-${item.findingId}-${item.comparisonKey}`}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-neutral-400">#{item.findingId}</span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">{item.severity}</span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">{item.sourceType}</span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">{item.category}</span>
          </div>
          <h4 className="mt-2 text-sm font-bold text-black">{item.title}</h4>
          <div className="mt-1 font-mono text-[11px] text-neutral-400">
            스캔 #{item.scanId}
            {item.ruleCode ? ` · ${item.ruleCode}` : ''}
            {item.filePath ? ` · ${item.filePath}` : ' · 파일 경로 없음'}
            {item.lineNumber ? ` : ${item.lineNumber}` : ''}
          </div>
        </article>
      ))}
    </div>
  );
}

function HistoryPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);

  const isGuestSession = user?.role === 'GUEST' || isStoredGuestSession();
  const hasMemberSession =
    Boolean(refreshToken) || user?.role === 'USER' || user?.role === 'ADMIN' || hasStoredMemberSession();
  const canAccessHistory = isAuthenticated && hasMemberSession && !isGuestSession;

  const [filterScanMode, setFilterScanMode] = useState<ScanMode | ''>('');
  const [filterStatus, setFilterStatus] = useState<'DONE' | 'FAILED' | ''>('');

  const [historyData, setHistoryData] = useState<HistoryScanListResponseData>(emptyHistoryData);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [selectedBaseScanId, setSelectedBaseScanId] = useState('');
  const [selectedTargetScanId, setSelectedTargetScanId] = useState('');
  const [compareData, setCompareData] = useState<ScanCompareResponseData | null>(null);
  const [isCompareLoading, setIsCompareLoading] = useState(false);
  const [compareErrorMessage, setCompareErrorMessage] = useState<string | null>(null);
  const [deletingScanIds, setDeletingScanIds] = useState<number[]>([]);

  const doneHistoryItems = useMemo(
    () => historyData.items.filter((item) => item.status === 'DONE' && getSafeScanType(item.scanType) === 'PROJECT_FILE'),
    [historyData.items],
  );
  const hasHistoryItems = useMemo(() => historyData.items.length > 0, [historyData.items.length]);

  const loadHistory = async (params?: { scanMode?: ScanMode | ''; status?: 'DONE' | 'FAILED' | '' }) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await getHistoryScans({
        page: 0,
        size: HISTORY_PAGE_SIZE,
        ...(params?.scanMode && { scanMode: params.scanMode }),
        ...(params?.status && { status: params.status }),
      });
      setHistoryData(data);
      return data;
    } catch (error) {
      setHistoryData(emptyHistoryData);
      setErrorMessage(error instanceof Error ? error.message : '히스토리를 불러오지 못했습니다.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccessHistory) {
      setHistoryData(emptyHistoryData);
      setErrorMessage(null);
      setNoticeMessage(null);
      setCompareData(null);
      setCompareErrorMessage(null);
      setSelectedBaseScanId('');
      setSelectedTargetScanId('');
      return;
    }

    let isMounted = true;

    const initializeHistory = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getHistoryScans({ page: 0, size: HISTORY_PAGE_SIZE });

        if (!isMounted) return;
        setHistoryData(data);
      } catch (error) {
        if (!isMounted) return;
        setHistoryData(emptyHistoryData);
        setErrorMessage(error instanceof Error ? error.message : '히스토리를 불러오지 못했습니다.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void initializeHistory();
    return () => { isMounted = false; };
  }, [canAccessHistory]);

  useEffect(() => {
    const availableIds = doneHistoryItems.map((item) => String(item.scanId));

    if (availableIds.length < 2) {
      if (selectedBaseScanId !== '') setSelectedBaseScanId('');
      if (selectedTargetScanId !== '') setSelectedTargetScanId('');
      setCompareData(null);
      setCompareErrorMessage(null);
      return;
    }

    const nextBaseScanId = availableIds.includes(selectedBaseScanId) ? selectedBaseScanId : availableIds[0];
    const nextTargetScanId =
      availableIds.includes(selectedTargetScanId) && selectedTargetScanId !== nextBaseScanId
        ? selectedTargetScanId
        : (availableIds.find((scanId) => scanId !== nextBaseScanId) ?? '');

    if (nextBaseScanId !== selectedBaseScanId) setSelectedBaseScanId(nextBaseScanId);
    if (nextTargetScanId !== selectedTargetScanId) setSelectedTargetScanId(nextTargetScanId);
  }, [doneHistoryItems, selectedBaseScanId, selectedTargetScanId]);

  useEffect(() => {
    setCompareData(null);
    setCompareErrorMessage(null);
  }, [selectedBaseScanId, selectedTargetScanId]);

  const handleFilterChange = (scanMode: ScanMode | '', status: 'DONE' | 'FAILED' | '') => {
    setFilterScanMode(scanMode);
    setFilterStatus(status);
    void loadHistory({ scanMode, status });
  };

  const handleRefresh = async () => {
    if (!canAccessHistory) return;
    setNoticeMessage(null);
    await loadHistory({ scanMode: filterScanMode, status: filterStatus });
  };

  useScanEventSubscription(
    () => { if (canAccessHistory) void handleRefresh(); },
    () => { if (canAccessHistory) void handleRefresh(); },
  );

  const handleDeleteScan = async (item: HistoryScanListItemData) => {
    const shouldDelete = window.confirm(`스캔 #${item.scanId} 이력을 삭제하시겠습니까?`);
    if (!shouldDelete) return;

    setDeletingScanIds((current) => [...current, item.scanId]);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      await deleteScanHistory(item.scanId);
      setNoticeMessage(`스캔 #${item.scanId} 이력이 삭제되었습니다.`);
      await loadHistory();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '스캔 이력을 삭제하지 못했습니다.');
      setNoticeMessage(null);
    } finally {
      setDeletingScanIds((current) => current.filter((scanId) => scanId !== item.scanId));
    }
  };

  const handleCompare = async () => {
    if (!selectedBaseScanId || !selectedTargetScanId) {
      setCompareErrorMessage('비교할 완료된 스캔 2개를 선택해주세요.');
      setCompareData(null);
      return;
    }

    if (selectedBaseScanId === selectedTargetScanId) {
      setCompareErrorMessage('기준 스캔과 비교 스캔은 서로 달라야 합니다.');
      setCompareData(null);
      return;
    }

    setIsCompareLoading(true);
    setCompareErrorMessage(null);

    try {
      const data = await getScanCompare(selectedBaseScanId, selectedTargetScanId);
      setCompareData(data);
    } catch (error) {
      setCompareData(null);
      setCompareErrorMessage(error instanceof Error ? error.message : '스캔 비교 결과를 불러오지 못했습니다.');
    } finally {
      setIsCompareLoading(false);
    }
  };

  const displayErrorMessage = errorMessage
    ? errorMessage.toLowerCase().includes('authentication') || errorMessage.includes('token is invalid')
      ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
      : errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')
      ? '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      : errorMessage.includes('히스토리를 불러오지 못했습니다') || errorMessage.includes('불러오지 못했습니다')
      ? '히스토리 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.'
      : errorMessage
    : null;

  const navigateToScan = (item: HistoryScanListItemData) => {
    navigate(
      item.status === 'DONE'
        ? ROUTES.resultDetail.replace(':scanId', String(item.scanId))
        : ROUTES.scanDetail.replace(':scanId', String(item.scanId)),
    );
  };

  return (
    <section className="space-y-8">
      {/* ── 히어로 ── */}
      <section className="border-b border-neutral-200 pb-12">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.32em] text-neutral-500 uppercase">History</p>
            <p className="mt-1 text-lg text-neutral-700">누적 스캔 수</p>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div className="bg-[#D4FC64] px-8 py-4 text-black">
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
              <span className="w-fit">지난 스캔 이력을 확인하고</span>
              <span className="w-fit">완료된 스캔끼리 비교해 변화 흐름을 확인할 수 있습니다.</span>
            </div>
            {canAccessHistory && (
              <button
                className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
                onClick={() => void handleRefresh()}
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                새로고침
              </button>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-neutral-200 pt-8">
          {[
            { label: '전체 취약점', value: historyData.summary.totalFindingCount, color: '#111111' },
            { label: 'Critical',   value: historyData.summary.criticalCount,      color: '#E63946' },
            { label: 'High',       value: historyData.summary.highCount,          color: '#FF8A33' },
            { label: 'Medium',     value: historyData.summary.mediumCount,        color: '#FFB627' },
            { label: 'Low',        value: historyData.summary.lowCount,           color: '#3D5AFE' },
            { label: 'Info',       value: historyData.summary.infoCount,          color: '#9CA3AF' },
          ].map((stat) => (
            <div className="flex items-baseline gap-3" key={stat.label}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: stat.color }} />
              <span className="text-4xl font-black tabular-nums">
                {stat.value}
              </span>
              <span className="text-sm text-neutral-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {!canAccessHistory ? (
        <div className="border border-dashed border-neutral-300 bg-white p-10">
          <h2 className="text-3xl font-black tracking-tight text-black">회원 로그인이 필요합니다</h2>
          <div className="mt-5">
            <button
              className="inline-flex items-center gap-2 bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
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
          {displayErrorMessage ? <PageBanner message={displayErrorMessage} tone="error" /> : noticeMessage ? <PageBanner message={noticeMessage} tone="success" /> : null}

          {/* ── 스캔 비교 ── */}
          <div className="border border-neutral-100 bg-white px-6 py-6">
            <div className="flex flex-col gap-4 border-b border-neutral-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">결과 비교</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-black">완료된 스캔 비교</h2>
                <p className="mt-2 text-sm leading-7 text-neutral-500">
                  기준 스캔 1개와 비교 스캔 1개를 선택해주세요. 기준 스캔은 이전 시점, 비교 스캔은 이후 시점으로 간주합니다.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,180px)_minmax(0,180px)_auto]">
                <label className="space-y-1.5">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400">기준 스캔</span>
                  <select
                    className="w-full border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-black"
                    onChange={(event) => setSelectedBaseScanId(event.target.value)}
                    value={selectedBaseScanId}
                  >
                    <option value="">스캔 선택</option>
                    {doneHistoryItems.map((item) => (
                      <option key={`base-${item.scanId}`} value={item.scanId}>
                        #{item.scanId} / 프로젝트 {item.projectId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400">비교 스캔</span>
                  <select
                    className="w-full border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-black"
                    onChange={(event) => setSelectedTargetScanId(event.target.value)}
                    value={selectedTargetScanId}
                  >
                    <option value="">스캔 선택</option>
                    {doneHistoryItems.map((item) => (
                      <option
                        disabled={String(item.scanId) === selectedBaseScanId}
                        key={`target-${item.scanId}`}
                        value={item.scanId}
                      >
                        #{item.scanId} / 프로젝트 {item.projectId}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="mt-auto inline-flex items-center justify-center gap-2 bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                  disabled={
                    isCompareLoading ||
                    doneHistoryItems.length < 2 ||
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

            {compareErrorMessage ? (
              <div className="mt-5 border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{compareErrorMessage}</div>
            ) : null}

            {compareData ? (
              <div className="mt-6 space-y-6">
                {/* 비교 요약 숫자 */}
                <div className="flex flex-wrap items-center gap-x-10 gap-y-4 border-b border-neutral-100 pb-6">
                  {[
                    { label: '신규',      value: compareData.summary.newCount,             color: '#E63946' },
                    { label: '해결됨',    value: compareData.summary.resolvedCount,         color: '#9FCC2E' },
                    { label: '유지됨',    value: compareData.summary.retainedCount,         color: '#9CA3AF' },
                    { label: '심각도 변경', value: compareData.summary.severityChangedCount, color: '#FF8A33' },
                  ].map((stat) => (
                    <div className="flex items-baseline gap-3" key={stat.label}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: stat.color }} />
                      <span className="text-3xl font-black tabular-nums">{stat.value}</span>
                      <span className="text-sm text-neutral-500">{stat.label}</span>
                    </div>
                  ))}
                  <div className="ml-auto flex items-center gap-6 font-mono text-xs text-neutral-400">
                    <span>기준 <span className="font-bold text-black">#{compareData.baseScanId}</span></span>
                    <span>→</span>
                    <span>비교 <span className="font-bold text-black">#{compareData.targetScanId}</span></span>
                    <span className="text-neutral-300">·</span>
                    <span>{compareData.summary.baseFindingCount} → {compareData.summary.targetFindingCount}건</span>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">신규 취약점</p>
                    <CompareFindingList emptyMessage="새롭게 추가된 취약점이 없습니다." items={compareData.newFindings} />
                  </div>
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">해결된 취약점</p>
                    <CompareFindingList emptyMessage="해결된 취약점이 없습니다." items={compareData.resolvedFindings} />
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">유지된 취약점</p>
                    <CompareFindingList emptyMessage="계속 유지된 취약점이 없습니다." items={compareData.retainedFindings} />
                  </div>
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">심각도 변경</p>
                    {compareData.severityChangedFindings.length === 0 ? (
                      <div className="border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-400">
                        심각도가 변경된 취약점이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {compareData.severityChangedFindings.map((item) => (
                          <article
                            className="border border-neutral-100 bg-white p-4"
                            key={`${item.baseFinding.findingId}-${item.targetFinding.findingId}`}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-neutral-400">#{item.targetFinding.findingId}</span>
                              <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">
                                {item.baseSeverity} → {item.targetSeverity}
                              </span>
                            </div>
                            <h4 className="mt-2 text-sm font-bold text-black">{item.targetFinding.title}</h4>
                            <div className="mt-1 font-mono text-[11px] text-neutral-400">
                              기준 #{item.baseFinding.scanId} · 비교 #{item.targetFinding.scanId}
                              {item.targetFinding.ruleCode ? ` · ${item.targetFinding.ruleCode}` : ''}
                              {item.targetFinding.filePath ? ` · ${item.targetFinding.filePath}` : ''}
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

          {/* ── 이력 목록 ── */}
          <div className="bg-white">
            {/* 필터 + 헤더 */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 px-6 py-5">
              <h2 className="text-2xl font-black tracking-tight">스캔 이력</h2>
              <div className="flex flex-wrap items-center gap-4">
                {/* 스캔 방식 */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">방식</span>
                  <div className="flex gap-1">
                    {([
                      { value: '' as const, label: '전체' },
                      { value: 'UPLOAD' as const, label: 'Upload' },
                      { value: 'AGENT' as const, label: 'Agent' },
                    ] satisfies { value: ScanMode | ''; label: string }[]).map((opt) => (
                      <button
                        className={`px-2.5 py-1 text-xs font-bold transition ${
                          filterScanMode === opt.value
                            ? 'bg-black text-white'
                            : 'border border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400 hover:text-black'
                        }`}
                        key={opt.value || 'all-mode'}
                        onClick={() => handleFilterChange(opt.value, filterStatus)}
                        type="button"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 결과 */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">결과</span>
                  <div className="flex gap-1">
                    {([
                      { value: '' as const, label: '전체' },
                      { value: 'DONE' as const, label: '완료' },
                      { value: 'FAILED' as const, label: '실패' },
                    ] satisfies { value: 'DONE' | 'FAILED' | ''; label: string }[]).map((opt) => (
                      <button
                        className={`px-2.5 py-1 text-xs font-bold transition ${
                          filterStatus === opt.value
                            ? 'bg-black text-white'
                            : 'border border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400 hover:text-black'
                        }`}
                        key={opt.value || 'all-status'}
                        onClick={() => handleFilterChange(filterScanMode, opt.value)}
                        type="button"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="px-6 py-16 text-center text-sm text-neutral-500">히스토리를 불러오는 중입니다.</div>
            ) : !hasHistoryItems ? (
              <div className="px-6 py-16 text-center text-sm text-neutral-400">
                아직 저장된 스캔 이력이 없습니다.
              </div>
            ) : (
              <div>
                {historyData.items.map((item) => {
                  const isDeleting = deletingScanIds.includes(item.scanId);
                  const isDeleteAllowed = canDeleteScanHistory(item.status);
                  const deleteBlockedReason = getDeleteBlockedReason(item.status);
                  const isActive = ['RUNNING', 'QUEUED', 'REQUESTED', 'RAW_UPLOADED'].includes(item.status);
                  const totalSeverity = item.criticalCount + item.highCount + item.mediumCount + item.lowCount;

                  return (
                    <div
                      className="group relative flex items-stretch border-b border-neutral-100 last:border-b-0 transition-colors hover:bg-[#FAFAF7]"
                      key={item.scanId}
                    >
                      {/* 왼쪽 상태 컬러 바 */}
                      <div className={`w-1 shrink-0 ${getScanStatusBarClass(item.status)}`} />

                      {/* 클릭 가능한 본문 */}
                      <button
                        className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 text-left"
                        onClick={() => navigateToScan(item)}
                        type="button"
                      >
                        {/* 왼쪽: 메타 */}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider ${getScanStatusChipClass(item.status)} ${isActive ? 'animate-pulse' : ''}`}
                            >
                              {item.status}
                            </span>
                            <ScanTypeBadge scanType={item.scanType} />
                            <ScanModeBadge scanMode={item.scanMode} source={item.source} />
                            <span className="font-mono text-xs text-neutral-300">·</span>
                            <span className="font-mono text-xs text-neutral-400">#{item.scanId}</span>
                            <span className="font-mono text-xs text-neutral-300">·</span>
                            <span className="font-mono text-xs text-neutral-400">프로젝트 #{item.projectId}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[11px] text-neutral-400">
                            <span>요청 {formatDateTime(item.requestedAt)}</span>
                            {item.completedAt ? <span>완료 {formatDateTime(item.completedAt)}</span> : null}
                          </div>
                        </div>

                        {/* 오른쪽: 심각도 pills */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.status === 'DONE' ? (
                            totalSeverity === 0 ? (
                              <span className="rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-bold text-neutral-400">
                                이슈 없음
                              </span>
                            ) : (
                              severityPills.map((pill) => {
                                const count = item[pill.countKey];
                                if (count === 0) return null;
                                return (
                                  <span
                                    key={pill.key}
                                    className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-bold ${pill.cls}`}
                                  >
                                    <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                                    {pill.label} {count}
                                  </span>
                                );
                              })
                            )
                          ) : isActive ? (
                            <span className="flex items-center gap-1.5 rounded border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-600">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              분석 중
                            </span>
                          ) : null}
                        </div>
                      </button>

                      {/* 삭제 버튼 */}
                      <div className="flex shrink-0 items-center gap-1 pr-4">
                        <button
                          className={`rounded p-1.5 transition ${
                            isDeleteAllowed && !isDeleting
                              ? 'text-neutral-300 hover:bg-rose-50 hover:text-rose-500'
                              : 'cursor-not-allowed text-neutral-200'
                          }`}
                          disabled={!isDeleteAllowed || isDeleting}
                          onClick={() => void handleDeleteScan(item)}
                          title={isDeleteAllowed ? '이력 삭제' : (deleteBlockedReason ?? undefined)}
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-neutral-200 transition group-hover:text-neutral-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default HistoryPage;
