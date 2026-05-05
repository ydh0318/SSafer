import { ArrowLeft, FileSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
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
          setErrorMessage(error instanceof Error ? error.message : '스캔 상태를 다시 불러오지 못했습니다.');
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
      <PageHero
        actions={
          <>
            {routeState.projectId ? (
              <Link
                className="inline-flex items-center gap-2 border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
                to={ROUTES.projectDetail.replace(':projectId', routeState.projectId)}
              >
                <ArrowLeft className="h-4 w-4" />
                프로젝트로 돌아가기
              </Link>
            ) : (
              <Link
                className="inline-flex items-center gap-2 border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
                to={ROUTES.projects}
              >
                <ArrowLeft className="h-4 w-4" />
                프로젝트 목록
              </Link>
            )}
            <Link
              className="inline-flex items-center gap-2 bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
              state={routeState}
              to={ROUTES.resultDetail.replace(':scanId', scanId)}
            >
              결과 화면 보기
              <FileSearch className="h-4 w-4" />
            </Link>
          </>
        }
        aside={
          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">LIVE STATUS</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-black">Scan #{scanId}</h2>
              </div>
              <PixelGoose
                mood={
                  statusData?.status === 'DONE'
                    ? 'victory'
                    : statusData?.status === 'FAILED'
                      ? 'alert'
                      : statusData?.status === 'RUNNING'
                        ? 'working'
                        : 'idle'
                }
                size={88}
              />
            </div>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              스캔 진행 상태는 이 화면에서 계속 갱신됩니다. 완료되면 결과 화면으로 바로 넘어가 최종 상태를 다시 확인할 수 있습니다.
            </p>
          </div>
        }
        description={
          <>
            스캔 요청 이후 현재 단계, 업로드 완료 여부, 종료 상태를 사용자 입장에서 지속적으로 볼 수 있도록 구성한 페이지입니다.
          </>
        }
        eyebrow="SCAN STATUS"
        title={
          <>
            스캔이 지금 어디까지 진행됐는지
            <br />
            한 화면에서 계속 확인합니다.
          </>
        }
      />

      {routeState.autoOpenedFromScanRequest ? (
        <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          스캔 요청이 정상적으로 등록되어 상태 화면으로 이동했습니다. 아래에서 진행 상황을 계속 확인할 수 있습니다.
        </div>
      ) : null}

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
