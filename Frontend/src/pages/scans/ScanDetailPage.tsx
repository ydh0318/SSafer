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

const LOAD_STATUS_ERROR_MESSAGE = '스캔 진행 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
const REFRESH_STATUS_ERROR_MESSAGE = '자동 새로고침에 일시적으로 실패했습니다. 잠시 후 다시 시도합니다.';

function ScanDetailPage() {
  const { scanId = '' } = useParams<{ scanId: string }>();
  const location = useLocation();
  const routeState = (location.state ?? {}) as ScanRouteState;

  const [statusData, setStatusData] = useState<ScanProgressStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);

  useEffect(() => {
    if (!scanId) {
      return;
    }

    let isMounted = true;

    const loadStatus = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setRefreshNotice(null);

      try {
        const data = await getScanStatus(scanId);

        if (!isMounted) {
          return;
        }

        setStatusData(data);
      } catch {
        if (!isMounted) {
          return;
        }

        setStatusData(null);
        setErrorMessage(LOAD_STATUS_ERROR_MESSAGE);
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
          setRefreshNotice(null);
        } catch {
          setRefreshNotice(REFRESH_STATUS_ERROR_MESSAGE);
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
    setRefreshNotice(null);

    try {
      const data = await getScanStatus(scanId);
      setStatusData(data);
    } catch {
      setStatusData(null);
      setErrorMessage(LOAD_STATUS_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  const canOpenResult = statusData?.status === 'DONE';

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
            {canOpenResult ? (
              <Link
                className="inline-flex items-center gap-2 bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
                state={routeState}
                to={ROUTES.resultDetail.replace(':scanId', scanId)}
              >
                결과 보기
                <FileSearch className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 bg-neutral-200 px-5 py-3 text-sm font-bold text-neutral-500">
                결과 생성 대기 중
                <FileSearch className="h-4 w-4" />
              </span>
            )}
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
              현재 스캔 상태를 기준으로 자동 새로고침이 동작합니다. 완료 전에는 결과 페이지로 이동하지 않고 진행 상황만 확인하도록
              안내합니다.
            </p>
          </div>
        }
        description={
          <>
            스캔 요청부터 업로드, 분석, 완료까지의 상태를 추적합니다. 실제 결과 검증은 `DONE` 상태가 된 이후 결과 페이지로 이동하는
            흐름이 가장 안전합니다.
          </>
        }
        eyebrow="SCAN STATUS"
        title={
          <>
            스캔 진행 상태를 확인하고
            <br />
            완료 후 결과로 이동하세요
          </>
        }
      />

      {routeState.autoOpenedFromScanRequest ? (
        <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          스캔이 생성되었습니다. 진행 상태를 확인하다가 `DONE` 상태가 되면 결과 페이지로 이동해 실제 결과를 확인할 수 있습니다.
        </div>
      ) : null}

      {refreshNotice ? (
        <div className="border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{refreshNotice}</div>
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
