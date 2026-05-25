import { useMemo, useState } from 'react';

import type { HistoryScanListItemData, ScanCompareResponseData } from '../../../types/scan';
import { getScanCompare } from '../../results/api/results';

type UseHistoryCompareParams = {
  doneHistoryItems: HistoryScanListItemData[];
  projectNameMap: Record<number, string>;
  onError: (message: string) => void;
  onWarning: (message: string) => void;
};

type CompareState = {
  data: ScanCompareResponseData | null;
  key: string;
};

function getCompareFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('not found') || normalizedMessage.includes('404')) {
    return '비교에 실패했습니다. 선택한 스캔 중 하나를 찾을 수 없습니다.';
  }

  if (
    normalizedMessage.includes('unauthorized') ||
    normalizedMessage.includes('forbidden') ||
    normalizedMessage.includes('401') ||
    normalizedMessage.includes('403')
  ) {
    return '비교에 실패했습니다. 접근 권한을 확인해 주세요.';
  }

  if (normalizedMessage.includes('internal server error') || normalizedMessage.includes('500')) {
    return '비교에 실패했습니다. 서버에서 비교 결과를 생성하지 못했습니다.';
  }

  return '비교에 실패했습니다. 같은 프로젝트의 완료된 프로젝트 파일 스캔 2개를 선택해 주세요.';
}

function useHistoryCompare({
  doneHistoryItems,
  projectNameMap,
  onError,
  onWarning,
}: UseHistoryCompareParams) {
  const [rawSelectedBaseScanId, setRawSelectedBaseScanId] = useState('');
  const [rawSelectedTargetScanId, setRawSelectedTargetScanId] = useState('');
  const [compareState, setCompareState] = useState<CompareState | null>(null);
  const [isCompareLoading, setIsCompareLoading] = useState(false);

  const comparableBaseScanIds = useMemo(
    () =>
      new Set(
        doneHistoryItems
          .filter((item) => doneHistoryItems.some((other) => other.projectId === item.projectId && other.scanId !== item.scanId))
          .map((item) => String(item.scanId)),
      ),
    [doneHistoryItems],
  );

  const availableBaseIds = useMemo(
    () => doneHistoryItems.map((item) => String(item.scanId)),
    [doneHistoryItems],
  );

  const selectedBaseScanId = useMemo(() => {
    if (availableBaseIds.length < 2 || comparableBaseScanIds.size === 0) {
      return '';
    }

    if (rawSelectedBaseScanId && comparableBaseScanIds.has(rawSelectedBaseScanId)) {
      return rawSelectedBaseScanId;
    }

    return availableBaseIds.find((scanId) => comparableBaseScanIds.has(scanId)) ?? '';
  }, [availableBaseIds, comparableBaseScanIds, rawSelectedBaseScanId]);

  const selectedBaseScan = useMemo(
    () => doneHistoryItems.find((item) => String(item.scanId) === selectedBaseScanId) ?? null,
    [doneHistoryItems, selectedBaseScanId],
  );

  const comparableTargetItems = useMemo(
    () =>
      selectedBaseScan
        ? doneHistoryItems.filter(
            (item) => item.projectId === selectedBaseScan.projectId && String(item.scanId) !== selectedBaseScanId,
          )
        : [],
    [doneHistoryItems, selectedBaseScan, selectedBaseScanId],
  );

  const availableTargetIds = useMemo(
    () => comparableTargetItems.map((item) => String(item.scanId)),
    [comparableTargetItems],
  );

  const selectedTargetScanId = useMemo(() => {
    if (!selectedBaseScan || availableTargetIds.length === 0) {
      return '';
    }

    if (availableTargetIds.includes(rawSelectedTargetScanId)) {
      return rawSelectedTargetScanId;
    }

    return availableTargetIds[0] ?? '';
  }, [availableTargetIds, rawSelectedTargetScanId, selectedBaseScan]);

  const compareGuideMessage = useMemo(() => {
    if (doneHistoryItems.length === 0) {
      return '비교 가능한 완료된 프로젝트 파일 스캔이 없습니다.';
    }

    if (!selectedBaseScan) {
      return '기준 스캔을 먼저 선택해 주세요.';
    }

    if (comparableTargetItems.length === 0) {
      return '같은 프로젝트에 비교할 다른 완료 스캔이 없습니다.';
    }

    return '같은 프로젝트의 완료된 프로젝트 파일 스캔만 비교할 수 있습니다.';
  }, [comparableTargetItems.length, doneHistoryItems.length, selectedBaseScan]);

  const formatScanOptionLabel = (item: { projectId: number; scanId: number }) =>
    `${projectNameMap[item.projectId] ?? `프로젝트 ${item.projectId}`} / #${item.scanId}`;

  const comparisonKey = `${selectedBaseScanId}:${selectedTargetScanId}`;
  const compareData = compareState?.key === comparisonKey ? compareState.data : null;

  const handleCompare = async () => {
    if (!selectedBaseScanId || !selectedTargetScanId) {
      onWarning('완료된 프로젝트 파일 스캔 2개를 먼저 선택해 주세요.');
      return;
    }

    if (selectedBaseScanId === selectedTargetScanId) {
      onWarning('기준 스캔과 비교 스캔은 서로 달라야 합니다.');
      return;
    }

    const baseScan = doneHistoryItems.find((item) => String(item.scanId) === selectedBaseScanId);
    const targetScan = doneHistoryItems.find((item) => String(item.scanId) === selectedTargetScanId);

    if (!baseScan || !targetScan || baseScan.projectId !== targetScan.projectId) {
      onWarning('같은 프로젝트의 완료된 프로젝트 파일 스캔만 비교할 수 있습니다.');
      return;
    }

    setIsCompareLoading(true);

    try {
      const data = await getScanCompare(selectedBaseScanId, selectedTargetScanId);
      setCompareState({
        data,
        key: comparisonKey,
      });
    } catch (error) {
      setCompareState(null);
      onError(getCompareFailureMessage(error));
    } finally {
      setIsCompareLoading(false);
    }
  };

  return {
    comparableTargetItems,
    compareData,
    compareGuideMessage,
    formatScanOptionLabel,
    handleCompare,
    isCompareLoading,
    selectedBaseScan,
    selectedBaseScanId,
    selectedTargetScanId,
    setSelectedBaseScanId: setRawSelectedBaseScanId,
    setSelectedTargetScanId: setRawSelectedTargetScanId,
  };
}

export default useHistoryCompare;
