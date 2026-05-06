import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageHero from '../../components/common/PageHero';
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

  const [historyData, setHistoryData] = useState<HistoryScanListResponseData>(emptyHistoryData);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !hasMemberSession || isGuestSession) {
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
  }, [hasMemberSession, isAuthenticated, isGuestSession]);

  const handleRefresh = async () => {
    if (!isAuthenticated || !hasMemberSession || isGuestSession) {
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

  const hasHistoryItems = historyData.items.length > 0;

  return (
    <section className="space-y-8">
      <PageHero
        actions={
          hasMemberSession && !isGuestSession ? (
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
        description={null}
        eyebrow="HISTORY"
        title="히스토리"
      />

      {!hasMemberSession || isGuestSession ? (
        <div className="border border-dashed border-neutral-300 bg-white p-10">
          <h2 className="text-3xl font-black tracking-tight text-black">로그인이 필요합니다.</h2>
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
            <div className="border border-neutral-200 bg-white p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">Total scans</div>
              <div className="mt-3 text-3xl font-black text-black">{historyData.summary.totalScanCount}</div>
            </div>
            <div className="border border-neutral-200 bg-white p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">Total findings</div>
              <div className="mt-3 text-3xl font-black text-black">{historyData.summary.totalFindingCount}</div>
            </div>
            <div className="border border-neutral-200 bg-white p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">Critical</div>
              <div className="mt-3 text-3xl font-black text-rose-600">{historyData.summary.criticalCount}</div>
            </div>
            <div className="border border-neutral-200 bg-white p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">High</div>
              <div className="mt-3 text-3xl font-black text-orange-500">{historyData.summary.highCount}</div>
            </div>
          </div>

          <div className="border border-neutral-200 bg-white p-8 shadow-sm">
            {isLoading ? (
              <div className="text-sm leading-7 text-neutral-600">불러오는 중...</div>
            ) : !hasHistoryItems ? (
              <div className="rounded-sm border border-dashed border-neutral-300 bg-[#fafafa] p-6 text-sm leading-7 text-neutral-600">
                표시할 히스토리가 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {historyData.items.map((item) => (
                  <article className="border border-neutral-200 bg-[#fafafa] p-4" key={item.scanId}>
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
                          <div className="mt-1 text-lg font-black text-rose-600">{item.criticalCount}</div>
                        </div>
                        <div className="border border-neutral-200 bg-white p-3">
                          <div className="font-bold text-neutral-400">HIGH</div>
                          <div className="mt-1 text-lg font-black text-orange-500">{item.highCount}</div>
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
