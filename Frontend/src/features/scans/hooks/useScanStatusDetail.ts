import { useCallback, useEffect, useState } from 'react';

import type { ScanProgressStatusData } from '../../../types/scan';
import { getScanStatus } from '../api/scans';
import { isTerminalScanStatus } from '../utils/scanPresentation';
import { useScanEventSubscription } from './useScanEventSubscription';

const LOAD_STATUS_ERROR_MESSAGE = '스캔 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
const REFRESH_STATUS_ERROR_MESSAGE = '자동 새로고침에 실패했습니다. 잠시 후 다시 시도해 주세요.';

function useScanStatusDetail(scanId: string, isAutoRefreshEnabled: boolean) {
  const [statusData, setStatusData] = useState<ScanProgressStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
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
  }, [scanId]);

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

    const intervalId = window.setInterval(() => {
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
      window.clearInterval(intervalId);
    };
  }, [isAutoRefreshEnabled, scanId, statusData]);

  useScanEventSubscription(
    (completedScanId) => {
      if (scanId && completedScanId === Number(scanId)) {
        void refreshStatus();
      }
    },
    (failedScanId) => {
      if (scanId && failedScanId === Number(scanId)) {
        void refreshStatus();
      }
    },
  );

  return {
    errorMessage,
    isLoading,
    refreshNotice,
    refreshStatus,
    setRefreshNotice,
    statusData,
  };
}

export default useScanStatusDetail;
