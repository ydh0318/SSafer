import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { getScanStatus } from '../../features/scans/api/scans';
import ScanProgressPanel from '../../features/scans/components/ScanProgressPanel';
import { isTerminalScanStatus } from '../../features/scans/utils/scanPresentation';
import type { ScanProgressStatusData } from '../../types/scan';

type ScanRouteState = {
  projectId?: string;
  autoOpenedFromScanRequest?: boolean;
};

function ScanDetailPage() {
  const { scanId = '' } = useParams<{ scanId: string }>();
  const location = useLocation();
  const routeState = (location.state ?? {}) as ScanRouteState;

  const [statusData, setStatusData] = useState<ScanProgressStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);

  useEffect(() => {
    if (!scanId) {
      return;
    }

    let isMounted = true;

    const loadStatus = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getScanStatus(scanId);

        if (!isMounted) {
          return;
        }

        setStatusData(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatusData(null);
        setErrorMessage(error instanceof Error ? error.message : '스캔 상태를 불러오지 못했습니다.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadStatus();

    return () => {
      isMounted = false;
    };
  }, [scanId]);

  useEffect(() => {
    if (!scanId || !isAutoRefreshEnabled || !statusData || isTerminalScanStatus(statusData.status)) {
      return;
    }

    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const data = await getScanStatus(scanId);
          setStatusData(data);
          setErrorMessage(null);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : '스캔 상태를 새로고침하지 못했습니다.');
        }
      })();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isAutoRefreshEnabled, scanId, statusData]);

  const handleRefresh = async () => {
    if (!scanId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await getScanStatus(scanId);
      setStatusData(data);
    } catch (error) {
      setStatusData(null);
      setErrorMessage(error instanceof Error ? error.message : '스캔 상태를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-[#eadfcb] bg-[linear-gradient(135deg,#fffdf8_0%,#f6efe0_52%,#efe7d9_100%)] px-6 py-8 shadow-[0_24px_90px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#8b7f6a]">스캔 진행 상태</p>
        <h2 className="mt-4 text-4xl font-black leading-tight text-[#111111] md:text-5xl">스캔 #{scanId} 상태 확인</h2>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[#5f564c]">
          이 화면에서 스캔이 실제로 등록되었는지, 현재 진행 중인지, 완료 또는 실패했는지를 계속 확인할 수 있습니다.
        </p>

        {routeState.autoOpenedFromScanRequest ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
            스캔 요청이 등록되었습니다. 이 페이지에서 자동 갱신으로 진행 상태를 확인할 수 있습니다.
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {routeState.projectId ? (
            <Link
              className="inline-flex rounded-full border border-[#cbbda6] px-5 py-3 text-sm font-bold text-[#3f352b] transition hover:border-[#9f937f]"
              to={ROUTES.projectDetail.replace(':projectId', routeState.projectId)}
            >
              프로젝트 상세로 돌아가기
            </Link>
          ) : (
            <Link
              className="inline-flex rounded-full border border-[#cbbda6] px-5 py-3 text-sm font-bold text-[#3f352b] transition hover:border-[#9f937f]"
              to={ROUTES.projects}
            >
              프로젝트 목록으로 이동
            </Link>
          )}
          <Link
            className="inline-flex rounded-full bg-[#111111] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#262626]"
            state={routeState}
            to={ROUTES.resultDetail.replace(':scanId', scanId)}
          >
            결과 화면 보기
          </Link>
        </div>
      </section>

      <ScanProgressPanel
        errorMessage={errorMessage}
        isAutoRefreshEnabled={isAutoRefreshEnabled}
        isLoading={isLoading}
        onAutoRefreshChange={setIsAutoRefreshEnabled}
        onRefresh={() => void handleRefresh()}
        statusData={statusData}
      />
    </section>
  );
}

export default ScanDetailPage;
