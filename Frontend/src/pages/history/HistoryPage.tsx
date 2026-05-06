import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import FeatureBanner from '../../components/common/FeatureBanner';
import FeatureInfoCard from '../../components/common/FeatureInfoCard';
import { ROUTES } from '../../constants/routes';
import { hasStoredMemberSession, isStoredGuestSession } from '../../features/auth/utils/session';
import { getHistoryScans } from '../../features/history/api/history';
import ScanStatusBadge from '../../features/scans/components/ScanStatusBadge';
import { formatDateTime, getScanModeLabel } from '../../features/scans/utils/scanPresentation';
import { useAuthStore } from '../../store/authStore';
import type { HistoryScanListResponseData } from '../../types/scan';

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
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

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

  useEffect(() => {
    if (!canAccessHistory) {
      setHistoryData(emptyHistoryData);
      setErrorMessage(null);
      return;
    }

    let isMounted = true;

    const loadHistory = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getHistoryScans({ page: 0, size: 10 });

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

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [canAccessHistory]);

  const handleRefresh = async () => {
    if (!canAccessHistory) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await getHistoryScans({ page: 0, size: 10 });
      setHistoryData(data);
    } catch (error) {
      setHistoryData(emptyHistoryData);
      setErrorMessage(error instanceof Error ? error.message : '히스토리를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasHistoryItems = useMemo(() => historyData.items.length > 0, [historyData.items.length]);

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
        description="과거 스캔 결과를 모아 보고, 지금까지 쌓인 위험과 완료 흐름을 한 번에 확인할 수 있습니다."
        eyebrow="HISTORY"
        title={
          <div>
            <div className="text-sm text-neutral-500">지금까지 쌓인 기록</div>
            <h1 className="mt-3 text-5xl font-black tracking-tight md:text-6xl">히스토리</h1>
          </div>
        }
      />

      {!canAccessHistory ? (
        <div className="border border-dashed border-neutral-300 bg-white p-10">
          <h2 className="text-3xl font-black tracking-tight text-black">회원 로그인 후 사용할 수 있어요.</h2>
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
          {errorMessage ? (
            <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{errorMessage}</div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FeatureInfoCard eyebrow="TOTAL SCANS" title={<div className="text-3xl font-black">{historyData.summary.totalScanCount}</div>} />
            <FeatureInfoCard eyebrow="TOTAL FINDINGS" title={<div className="text-3xl font-black">{historyData.summary.totalFindingCount}</div>} />
            <FeatureInfoCard eyebrow="CRITICAL" title={<div className="text-3xl font-black text-[#E63946]">{historyData.summary.criticalCount}</div>} />
            <FeatureInfoCard eyebrow="HIGH" title={<div className="text-3xl font-black text-[#FF8A33]">{historyData.summary.highCount}</div>} />
          </div>

          <div className="border border-black/5 bg-white p-8 shadow-sm">
            {isLoading ? (
              <div className="text-sm leading-7 text-neutral-600">히스토리를 불러오는 중입니다.</div>
            ) : !hasHistoryItems ? (
              <div className="theme-dark-soft-card rounded-sm border border-dashed border-neutral-300 bg-[#fafafa] p-6 text-sm leading-7 text-neutral-600">
                아직 저장된 히스토리가 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {historyData.items.map((item) => (
                  <article className="border border-black/5 bg-[#fafaf8] p-4" key={item.scanId}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <ScanStatusBadge status={item.status} />
                          <span className="inline-flex rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-bold text-neutral-700">
                            {getScanModeLabel(item.scanMode)}
                          </span>
                          <span className="inline-flex rounded-full bg-black px-2.5 py-1 text-xs font-bold text-white">
                            Scan #{item.scanId}
                          </span>
                          <span className="inline-flex rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-bold text-neutral-700">
                            Project #{item.projectId}
                          </span>
                        </div>

                        <div className="grid gap-3 text-sm text-neutral-600 md:grid-cols-2">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Requested</div>
                            <div className="mt-1 font-semibold text-black">{formatDateTime(item.requestedAt)}</div>
                          </div>
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Completed</div>
                            <div className="mt-1 font-semibold text-black">{formatDateTime(item.completedAt)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid min-w-[240px] grid-cols-3 gap-2 text-xs text-neutral-600">
                        <div className="border border-neutral-200 bg-white p-3">
                          <div className="font-bold text-neutral-400">TOTAL</div>
                          <div className="mt-1 text-lg font-black text-black">{item.totalFindingCount}</div>
                        </div>
                        <div className="border border-neutral-200 bg-white p-3">
                          <div className="font-bold text-neutral-400">CRIT</div>
                          <div className="mt-1 text-lg font-black text-[#E63946]">{item.criticalCount}</div>
                        </div>
                        <div className="border border-neutral-200 bg-white p-3">
                          <div className="font-bold text-neutral-400">HIGH</div>
                          <div className="mt-1 text-lg font-black text-[#FF8A33]">{item.highCount}</div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default HistoryPage;
