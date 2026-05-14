import { ArrowRightLeft, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import FeatureBanner from '../../components/common/FeatureBanner';
import FeatureInfoCard from '../../components/common/FeatureInfoCard';
import PageBanner from '../../components/common/PageBanner';
import { ROUTES } from '../../constants/routes';
import { hasStoredMemberSession, isStoredGuestSession } from '../../features/auth/utils/session';
import { getHistoryScans } from '../../features/history/api/history';
import { getScanCompare } from '../../features/results/api/results';
import { deleteScanHistory } from '../../features/scans/api/scans';
import ScanStatusBadge from '../../features/scans/components/ScanStatusBadge';
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

function CompareFindingList({
  items,
  emptyMessage,
}: {
  items: ScanCompareFindingData[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-4 py-5 text-sm text-neutral-500">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article className="border border-black/5 bg-[#fafaf8] p-4" key={`${item.scanId}-${item.findingId}-${item.comparisonKey}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-black px-2.5 py-1 text-white">#{item.findingId}</span>
            <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-neutral-700">{item.severity}</span>
            <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-neutral-700">{item.sourceType}</span>
            <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-neutral-700">{item.category}</span>
          </div>
          <h4 className="mt-3 text-base font-black text-black">{item.title}</h4>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
            <span>스캔 #{item.scanId}</span>
            <span>{item.ruleCode}</span>
            <span>{item.filePath ?? '파일 경로 없음'}</span>
            <span>라인 {item.lineNumber ?? '-'}</span>
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

  const loadHistory = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await getHistoryScans({ page: 0, size: HISTORY_PAGE_SIZE });
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

        if (!isMounted) {
          return;
        }

        setHistoryData(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setHistoryData(emptyHistoryData);
        setErrorMessage(error instanceof Error ? error.message : '히스토리를 불러오지 못했습니다.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initializeHistory();

    return () => {
      isMounted = false;
    };
  }, [canAccessHistory]);

  useEffect(() => {
    const availableIds = doneHistoryItems.map((item) => String(item.scanId));

    if (availableIds.length < 2) {
      if (selectedBaseScanId !== '') {
        setSelectedBaseScanId('');
      }

      if (selectedTargetScanId !== '') {
        setSelectedTargetScanId('');
      }

      setCompareData(null);
      setCompareErrorMessage(null);
      return;
    }

    const nextBaseScanId = availableIds.includes(selectedBaseScanId) ? selectedBaseScanId : availableIds[0];
    const nextTargetScanId =
      availableIds.includes(selectedTargetScanId) && selectedTargetScanId !== nextBaseScanId
        ? selectedTargetScanId
        : (availableIds.find((scanId) => scanId !== nextBaseScanId) ?? '');

    if (nextBaseScanId !== selectedBaseScanId) {
      setSelectedBaseScanId(nextBaseScanId);
    }

    if (nextTargetScanId !== selectedTargetScanId) {
      setSelectedTargetScanId(nextTargetScanId);
    }
  }, [doneHistoryItems, selectedBaseScanId, selectedTargetScanId]);

  useEffect(() => {
    setCompareData(null);
    setCompareErrorMessage(null);
  }, [selectedBaseScanId, selectedTargetScanId]);

  const handleRefresh = async () => {
    if (!canAccessHistory) {
      return;
    }

    setNoticeMessage(null);
    await loadHistory();
  };

  useScanEventSubscription(
    () => {
      if (canAccessHistory) {
        void handleRefresh();
      }
    },
    () => {
      if (canAccessHistory) {
        void handleRefresh();
      }
    },
  );

  const handleDeleteScan = async (item: HistoryScanListItemData) => {
    const shouldDelete = window.confirm(`스캔 #${item.scanId} 이력을 삭제하시겠습니까?`);

    if (!shouldDelete) {
      return;
    }

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

  return (
    <section className="space-y-8">
      <FeatureBanner
        actions={
          canAccessHistory ? (
            <button
              className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
              onClick={() => void handleRefresh()}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              새로고침
            </button>
          ) : null
        }
        description="지난 스캔 이력을 확인하고, 완료된 스캔끼리 비교해 취약점 변화 흐름을 확인할 수 있습니다."
        eyebrow="히스토리"
        title={
          <div>
            <div className="text-sm text-neutral-500">지난 스캔 활동</div>
            <h1 className="mt-3 text-5xl font-black tracking-tight md:text-6xl">스캔 히스토리</h1>
          </div>
        }
      />

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
          {errorMessage ? <PageBanner message={errorMessage} tone="error" /> : noticeMessage ? <PageBanner message={noticeMessage} tone="success" /> : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FeatureInfoCard eyebrow="전체 스캔" title={<div className="text-3xl font-black">{historyData.summary.totalScanCount}</div>} />
            <FeatureInfoCard eyebrow="전체 취약점" title={<div className="text-3xl font-black">{historyData.summary.totalFindingCount}</div>} />
            <FeatureInfoCard eyebrow="치명적" title={<div className="text-3xl font-black text-[#E63946]">{historyData.summary.criticalCount}</div>} />
            <FeatureInfoCard eyebrow="높음" title={<div className="text-3xl font-black text-[#FF8A33]">{historyData.summary.highCount}</div>} />
          </div>

          <div className="border border-black/5 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-neutral-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-[0.24em] text-neutral-400">결과 비교</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-black">완료된 스캔 비교</h2>
                <p className="mt-3 text-sm leading-7 text-neutral-600">
                  기준 스캔 1개와 비교 스캔 1개를 선택해주세요. 순서에 따라 결과가 달라질 수 있으며,
                  기준 스캔은 이전 시점, 비교 스캔은 이후 시점으로 간주합니다.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,180px)_minmax(0,180px)_auto]">
                <label className="space-y-2 text-sm text-neutral-600">
                  <span className="block text-[11px] font-bold tracking-[0.24em] text-neutral-400">기준 스캔</span>
                  <select
                    className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-black"
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
                <label className="space-y-2 text-sm text-neutral-600">
                  <span className="block text-[11px] font-bold tracking-[0.24em] text-neutral-400">비교 스캔</span>
                  <select
                    className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-black"
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
                  className="inline-flex items-center justify-center gap-2 bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
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
              <div className="mt-6 border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{compareErrorMessage}</div>
            ) : null}

            {compareData ? (
              <div className="mt-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FeatureInfoCard eyebrow="신규" title={<div className="text-3xl font-black">{compareData.summary.newCount}</div>} />
                  <FeatureInfoCard eyebrow="해결됨" title={<div className="text-3xl font-black">{compareData.summary.resolvedCount}</div>} />
                  <FeatureInfoCard eyebrow="유지됨" title={<div className="text-3xl font-black">{compareData.summary.retainedCount}</div>} />
                  <FeatureInfoCard eyebrow="심각도 변경" title={<div className="text-3xl font-black">{compareData.summary.severityChangedCount}</div>} />
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="border border-neutral-200 bg-[#fafaf8] p-4 text-sm">
                    <div className="text-[11px] font-bold tracking-[0.24em] text-neutral-400">기준 스캔</div>
                    <div className="mt-2 text-lg font-black text-black">#{compareData.baseScanId}</div>
                    <div className="mt-1 text-neutral-600">{compareData.baseStatus}</div>
                  </div>
                  <div className="border border-neutral-200 bg-[#fafaf8] p-4 text-sm">
                    <div className="text-[11px] font-bold tracking-[0.24em] text-neutral-400">비교 스캔</div>
                    <div className="mt-2 text-lg font-black text-black">#{compareData.targetScanId}</div>
                    <div className="mt-1 text-neutral-600">{compareData.targetStatus}</div>
                  </div>
                  <div className="border border-neutral-200 bg-[#fafaf8] p-4 text-sm">
                    <div className="text-[11px] font-bold tracking-[0.24em] text-neutral-400">프로젝트</div>
                    <div className="mt-2 text-lg font-black text-black">#{compareData.projectId}</div>
                    <div className="mt-1 text-neutral-600">동일 프로젝트 기준 비교</div>
                  </div>
                  <div className="border border-neutral-200 bg-[#fafaf8] p-4 text-sm">
                    <div className="text-[11px] font-bold tracking-[0.24em] text-neutral-400">취약점 수</div>
                    <div className="mt-2 text-sm font-bold text-black">
                      {compareData.summary.baseFindingCount} -&gt; {compareData.summary.targetFindingCount}
                    </div>
                    <div className="mt-1 text-neutral-600">기준 스캔에서 비교 스캔으로 변화</div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-xl font-black tracking-tight text-black">신규 취약점</h3>
                    <CompareFindingList emptyMessage="새롭게 추가된 취약점이 없습니다." items={compareData.newFindings} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-black tracking-tight text-black">해결된 취약점</h3>
                    <CompareFindingList emptyMessage="해결된 취약점이 없습니다." items={compareData.resolvedFindings} />
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-xl font-black tracking-tight text-black">유지된 취약점</h3>
                    <CompareFindingList emptyMessage="계속 유지된 취약점이 없습니다." items={compareData.retainedFindings} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-black tracking-tight text-black">심각도 변경</h3>
                    {compareData.severityChangedFindings.length === 0 ? (
                      <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-4 py-5 text-sm text-neutral-500">
                        심각도가 변경된 취약점이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {compareData.severityChangedFindings.map((item) => (
                          <article
                            className="border border-black/5 bg-[#fafaf8] p-4"
                            key={`${item.baseFinding.findingId}-${item.targetFinding.findingId}`}
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                              <span className="rounded-full bg-black px-2.5 py-1 text-white">#{item.targetFinding.findingId}</span>
                              <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-neutral-700">
                                {item.baseSeverity} -&gt; {item.targetSeverity}
                              </span>
                            </div>
                            <h4 className="mt-3 text-base font-black text-black">{item.targetFinding.title}</h4>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
                              <span>기준 #{item.baseFinding.scanId}</span>
                              <span>비교 #{item.targetFinding.scanId}</span>
                              <span>{item.targetFinding.ruleCode}</span>
                              <span>{item.targetFinding.filePath ?? '파일 경로 없음'}</span>
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

          <div className="border border-black/5 bg-white p-8 shadow-sm">
            {isLoading ? (
              <div className="text-sm leading-7 text-neutral-600">히스토리를 불러오는 중입니다...</div>
            ) : !hasHistoryItems ? (
              <div className="theme-dark-soft-card rounded-sm border border-dashed border-neutral-300 bg-[#fafafa] p-6 text-sm leading-7 text-neutral-600">
                아직 저장된 스캔 이력이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {historyData.items.map((item) => {
                  const isDeleting = deletingScanIds.includes(item.scanId);
                  const isDeleteAllowed = canDeleteScanHistory(item.status);
                  const deleteBlockedReason = getDeleteBlockedReason(item.status);

                  return (
                    <article className="border border-black/5 bg-[#fafaf8] p-4" key={item.scanId}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <ScanStatusBadge status={item.status} />
                            <ScanTypeBadge scanType={item.scanType} />
                            <span className="inline-flex rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-bold text-neutral-700">
                              {getScanModeLabel(item.scanMode, item.source)}
                            </span>
                            <span className="inline-flex rounded-full bg-black px-2.5 py-1 text-xs font-bold text-white">
                              스캔 #{item.scanId}
                            </span>
                            <span className="inline-flex rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-bold text-neutral-700">
                              프로젝트 #{item.projectId}
                            </span>
                          </div>

                          <div className="grid gap-3 text-sm text-neutral-600 md:grid-cols-2">
                            <div>
                              <div className="text-[11px] font-bold tracking-[0.24em] text-neutral-400">요청 시각</div>
                              <div className="mt-1 font-semibold text-black">{formatDateTime(item.requestedAt)}</div>
                            </div>
                            <div>
                              <div className="text-[11px] font-bold tracking-[0.24em] text-neutral-400">완료 시각</div>
                              <div className="mt-1 font-semibold text-black">{formatDateTime(item.completedAt)}</div>
                            </div>
                          </div>
                        </div>

                        <div className="grid min-w-[240px] grid-cols-3 gap-2 text-xs text-neutral-600">
                          <div className="border border-neutral-200 bg-white p-3">
                            <div className="font-bold text-neutral-400">전체</div>
                            <div className="mt-1 text-lg font-black text-black">{item.totalFindingCount}</div>
                          </div>
                          <div className="border border-neutral-200 bg-white p-3">
                            <div className="font-bold text-neutral-400">치명적</div>
                            <div className="mt-1 text-lg font-black text-[#E63946]">{item.criticalCount}</div>
                          </div>
                          <div className="border border-neutral-200 bg-white p-3">
                            <div className="font-bold text-neutral-400">높음</div>
                            <div className="mt-1 text-lg font-black text-[#FF8A33]">{item.highCount}</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className="border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-black hover:text-black"
                          onClick={() =>
                            navigate(
                              item.status === 'DONE'
                                ? ROUTES.resultDetail.replace(':scanId', String(item.scanId))
                                : ROUTES.scanDetail.replace(':scanId', String(item.scanId)),
                            )
                          }
                          type="button"
                        >
                          {item.status === 'DONE' ? '결과 보기' : '진행 상황 보기'}
                        </button>
                        <button
                          className={
                            isDeleteAllowed && !isDeleting
                              ? 'inline-flex items-center gap-2 border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-50'
                              : 'inline-flex cursor-not-allowed items-center gap-2 border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-400'
                          }
                          disabled={!isDeleteAllowed || isDeleting}
                          onClick={() => void handleDeleteScan(item)}
                          title={isDeleteAllowed ? undefined : deleteBlockedReason ?? undefined}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                          {isDeleting ? '삭제 중...' : '이력 삭제'}
                        </button>
                      </div>
                    </article>
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
