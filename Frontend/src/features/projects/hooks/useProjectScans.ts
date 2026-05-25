import { useEffect, useMemo, useState } from 'react';

import type {
  ProjectScanListItemData,
  ProjectScanListQuery,
  ScanSummaryData,
} from '../../../types/scan';
import { useToast } from '../../feedback/useToast';
import { getScanSummary } from '../../results/api/results';
import { deleteScanHistory, getProjectScans } from '../../scans/api/scans';

const initialScanFilters: ProjectScanListQuery = {
  page: 0,
  size: 20,
  status: '',
  scanMode: '',
};

function useProjectScans(projectId: string) {
  const toast = useToast();
  const [scanFilters, setScanFilters] = useState<ProjectScanListQuery>(initialScanFilters);
  const [scans, setScans] = useState<ProjectScanListItemData[]>([]);
  const [scanListError, setScanListError] = useState<string | null>(null);
  const [isScanListLoading, setIsScanListLoading] = useState(true);
  const [deletingScanIds, setDeletingScanIds] = useState<number[]>([]);
  const [latestScanSummaryState, setLatestScanSummaryState] = useState<{
    scanId: number;
    summary: ScanSummaryData | null;
  } | null>(null);

  const refreshScans = async () => {
    if (!projectId) {
      return;
    }

    setIsScanListLoading(true);
    setScanListError(null);

    try {
      const data = await getProjectScans(projectId, scanFilters);
      setScans(data.items);
    } catch (error) {
      setScans([]);
      setScanListError(error instanceof Error ? error.message : '스캔 목록을 불러오지 못했습니다.');
    } finally {
      setIsScanListLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let isMounted = true;

    const loadScans = async () => {
      setIsScanListLoading(true);
      setScanListError(null);

      try {
        const data = await getProjectScans(projectId, scanFilters);

        if (isMounted) {
          setScans(data.items);
        }
      } catch (error) {
        if (isMounted) {
          setScans([]);
          setScanListError(error instanceof Error ? error.message : '스캔 목록을 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsScanListLoading(false);
        }
      }
    };

    void loadScans();

    return () => {
      isMounted = false;
    };
  }, [projectId, scanFilters]);

  const activeScans = useMemo(
    () => scans.filter((scan) => ['REQUESTED', 'QUEUED', 'RUNNING', 'RAW_UPLOADED'].includes(scan.status)),
    [scans],
  );
  const completedScans = useMemo(() => scans.filter((scan) => scan.status === 'DONE'), [scans]);
  const failedScans = useMemo(
    () => scans.filter((scan) => scan.status === 'FAILED' || scan.status === 'CANCELED'),
    [scans],
  );
  const latestScan = completedScans[0] ?? null;
  const latestCompletedScanId = latestScan?.scanId ?? null;

  useEffect(() => {
    if (!latestCompletedScanId) {
      return;
    }

    let isMounted = true;

    void getScanSummary(latestCompletedScanId)
      .then((summary) => {
        if (isMounted) {
          setLatestScanSummaryState({
            scanId: latestCompletedScanId,
            summary,
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setLatestScanSummaryState({
            scanId: latestCompletedScanId,
            summary: null,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latestCompletedScanId]);

  const latestScanSummary =
    latestScanSummaryState?.scanId === latestCompletedScanId ? latestScanSummaryState.summary : null;

  const deleteScan = async (scanId: number) => {
    if (!projectId) {
      return;
    }

    const shouldDelete = window.confirm(`스캔 #${scanId} 이력을 삭제하시겠습니까?`);

    if (!shouldDelete) {
      return;
    }

    setDeletingScanIds((current) => [...current, scanId]);
    setScanListError(null);

    try {
      await deleteScanHistory(scanId);
      toast.success(`스캔 #${scanId} 이력을 삭제했습니다.`, { durationMs: 2000 });
      await refreshScans();
    } catch (error) {
      setScanListError(error instanceof Error ? error.message : '스캔을 삭제하지 못했습니다.');
    } finally {
      setDeletingScanIds((current) => current.filter((value) => value !== scanId));
    }
  };

  return {
    activeScans,
    completedScans,
    deleteScan,
    deletingScanIds,
    failedScans,
    isScanListLoading,
    latestScan,
    latestScanSummary,
    refreshScans,
    scanFilters,
    scanListError,
    scans,
    setScanFilters,
  };
}

export default useProjectScans;
