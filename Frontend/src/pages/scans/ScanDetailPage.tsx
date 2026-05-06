import { ArrowLeft, FileSearch } from 'lucide-react';
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

const LOAD_STATUS_ERROR_MESSAGE = '스캔 진행 상태를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
const REFRESH_STATUS_ERROR_MESSAGE = '새로고침 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';

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
  const backTo = routeState.projectId ? ROUTES.projectDetail.replace(':projectId', routeState.projectId) : ROUTES.projects;

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-neutral-500 transition hover:text-black"
          to={backTo}
        >
          <ArrowLeft className="h-4 w-4" />
          프로젝트로 돌아가기
        </Link>

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
            결과 준비 중
            <FileSearch className="h-4 w-4" />
          </span>
        )}
      </div>

      {routeState.autoOpenedFromScanRequest ? (
        <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          스캔 요청이 접수되었습니다. 완료되면 결과 화면으로 이동할 수 있습니다.
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
