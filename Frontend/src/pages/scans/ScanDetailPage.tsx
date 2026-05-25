import { ArrowLeft, FileSearch, Gamepad2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { useToast } from '../../features/feedback/useToast';
import ScanProgressPanel from '../../features/scans/components/ScanProgressPanel';
import useScanStatusDetail from '../../features/scans/hooks/useScanStatusDetail';
import { isTerminalScanStatus } from '../../features/scans/utils/scanPresentation';

type ScanRouteState = {
  projectId?: string;
  autoOpenedFromScanRequest?: boolean;
};

function ScanDetailPage() {
  const { scanId = '' } = useParams<{ scanId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = useMemo(() => (location.state ?? {}) as ScanRouteState, [location.state]);
  const toast = useToast();
  const hasShownSuccessToastRef = useRef(false);
  const hasAutoNavigatedRef = useRef(false);
  const hasSeenNonTerminalScanStatusRef = useRef(false);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const { errorMessage, isLoading, refreshNotice, refreshStatus, setRefreshNotice, statusData } = useScanStatusDetail(
    scanId,
    isAutoRefreshEnabled,
  );

  useEffect(() => {
    if (!routeState.autoOpenedFromScanRequest || hasShownSuccessToastRef.current) {
      return;
    }

    hasShownSuccessToastRef.current = true;
    toast.success('스캔 요청이 접수되었습니다.', { durationMs: 2000 });
  }, [routeState.autoOpenedFromScanRequest, toast]);

  useEffect(() => {
    if (!refreshNotice) {
      return;
    }

    toast.warning(refreshNotice, { durationMs: 2000 });
    setRefreshNotice(null);
  }, [refreshNotice, setRefreshNotice, toast]);

  useEffect(() => {
    if (statusData && !isTerminalScanStatus(statusData.status)) {
      hasSeenNonTerminalScanStatusRef.current = true;
    }
  }, [statusData]);

  useEffect(() => {
    const shouldOpenResultAutomatically =
      routeState.autoOpenedFromScanRequest || hasSeenNonTerminalScanStatusRef.current;

    if (
      !shouldOpenResultAutomatically ||
      !statusData ||
      statusData.status !== 'DONE' ||
      hasAutoNavigatedRef.current
    ) {
      return;
    }

    hasAutoNavigatedRef.current = true;
    toast.success('분석이 완료되어 결과 페이지로 이동합니다.', { durationMs: 2000 });
    window.setTimeout(() => {
      navigate(ROUTES.resultDetail.replace(':scanId', scanId), { state: routeState });
    }, 500);
  }, [navigate, routeState, scanId, statusData, toast]);

  const canOpenResult = statusData?.status === 'DONE';
  const backTo = routeState.projectId ? ROUTES.projectDetail.replace(':projectId', routeState.projectId) : ROUTES.projects;

  return (
    <section className="space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-neutral-500 transition hover:text-black"
          to={backTo}
        >
          <ArrowLeft className="h-4 w-4" />
          프로젝트로 돌아가기
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex items-center gap-1.5 border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600 transition hover:border-black hover:text-black"
            state={{ returnToScanId: scanId, projectId: routeState.projectId }}
            to={ROUTES.typingGame}
          >
            <Gamepad2 className="h-3.5 w-3.5" />
            타이핑 게임 열기
          </Link>

          {canOpenResult ? (
            <Link
              className="inline-flex items-center gap-1.5 bg-[#D4FC64] px-4 py-2 text-xs font-bold text-black transition hover:brightness-95"
              state={routeState}
              to={ROUTES.resultDetail.replace(':scanId', scanId)}
            >
              결과 보기
              <FileSearch className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-400">
              결과 대기 중
              <FileSearch className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>

      <ScanProgressPanel
        errorMessage={errorMessage}
        isAutoRefreshEnabled={isAutoRefreshEnabled}
        isLoading={isLoading}
        onAutoRefreshChange={setIsAutoRefreshEnabled}
        onRefresh={() => void refreshStatus()}
        statusData={statusData}
      />
    </section>
  );
}

export default ScanDetailPage;
