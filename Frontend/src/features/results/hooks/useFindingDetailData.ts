import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  FindingResolutionStatus,
  ScanBasicData,
  ScanFindingDetailData,
  ScanFindingListItemData,
} from '../../../types/scan';
import { useToast } from '../../feedback/useToast';
import { approveFindingPatch } from '../../scans/api/scans';
import { getScanBasic, getScanFindingDetail, getScanFindings, updateFindingResolutionStatus } from '../api/results';
import { findingSeverityOrder, getPracticeSnippet, prettyJsonText } from '../utils/findingDetailPresentation';

function useFindingDetailData(scanId: string, findingId: string) {
  const toast = useToast();
  const [scanBasic, setScanBasic] = useState<ScanBasicData | null>(null);
  const [finding, setFinding] = useState<ScanFindingDetailData | null>(null);
  const [relatedFindings, setRelatedFindings] = useState<ScanFindingListItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApprovingPatch, setIsApprovingPatch] = useState(false);
  const [approveErrorMessage, setApproveErrorMessage] = useState<string | null>(null);
  const [isUpdatingResolutionStatus, setIsUpdatingResolutionStatus] = useState(false);

  const refreshFindingData = useCallback(async () => {
    if (!scanId || !findingId) {
      return;
    }

    const [basicData, detailData, findingListData] = await Promise.all([
      getScanBasic(scanId),
      getScanFindingDetail(scanId, findingId),
      getScanFindings(scanId, { page: 0, size: 100 }),
    ]);

    setScanBasic(basicData);
    setFinding(detailData);
    setRelatedFindings(findingListData.items);
  }, [findingId, scanId]);

  useEffect(() => {
    if (!scanId || !findingId) {
      return;
    }

    let isMounted = true;

    const loadFinding = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [basicData, detailData, findingListData] = await Promise.all([
          getScanBasic(scanId),
          getScanFindingDetail(scanId, findingId),
          getScanFindings(scanId, { page: 0, size: 100 }),
        ]);

        if (!isMounted) {
          return;
        }

        setScanBasic(basicData);
        setFinding(detailData);
        setRelatedFindings(findingListData.items);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : '취약점 상세 정보를 불러오지 못했습니다.');
        setScanBasic(null);
        setFinding(null);
        setRelatedFindings([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadFinding();

    return () => {
      isMounted = false;
    };
  }, [findingId, scanId]);

  useEffect(() => {
    if (!finding || finding.resolutionStatus !== 'IN_PROGRESS' || !scanId || !findingId) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const [refreshedFinding, refreshedFindingList] = await Promise.all([
            getScanFindingDetail(scanId, findingId),
            getScanFindings(scanId, { page: 0, size: 100 }),
          ]);

          if (!cancelled) {
            setFinding(refreshedFinding);
            setRelatedFindings(refreshedFindingList.items);
          }
        } catch {
          // Ignore transient polling failures.
        }
      })();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [finding, findingId, scanId]);

  const handleApprovePatch = useCallback(async () => {
    if (!scanId || !findingId || !finding) {
      return;
    }

    setApproveErrorMessage(null);
    setIsApprovingPatch(true);

    try {
      await approveFindingPatch(scanId, findingId);
      await refreshFindingData();
      toast.success('패치 적용 요청을 전송했습니다.', { durationMs: 2000 });
    } catch (error) {
      setApproveErrorMessage(error instanceof Error ? error.message : '패치 적용 요청에 실패했습니다.');
    } finally {
      setIsApprovingPatch(false);
    }
  }, [finding, findingId, refreshFindingData, scanId, toast]);

  const handleResolutionStatusChange = useCallback(
    async (nextStatus: FindingResolutionStatus) => {
      if (!scanId || !findingId || !finding || finding.resolutionStatus === nextStatus || isUpdatingResolutionStatus) {
        return;
      }

      setIsUpdatingResolutionStatus(true);

      try {
        await updateFindingResolutionStatus(findingId, nextStatus);
        await refreshFindingData();
        toast.success('조치 상태를 변경했습니다.', { durationMs: 2000 });
      } catch (error) {
        const message = error instanceof Error ? error.message : '조치 상태를 변경하지 못했습니다.';
        toast.error(message, { durationMs: 2500 });
      } finally {
        setIsUpdatingResolutionStatus(false);
      }
    },
    [finding, findingId, isUpdatingResolutionStatus, refreshFindingData, scanId, toast],
  );

  const practiceSnippet = useMemo(() => getPracticeSnippet(finding), [finding]);
  const rawSnippetText = useMemo(() => prettyJsonText(finding?.rawSnippetJson ?? null), [finding?.rawSnippetJson]);
  const hasPatches = Boolean(finding?.fix?.patches?.length);
  const isPollingPatch = finding?.resolutionStatus === 'IN_PROGRESS';
  const relatedFindingGroups = useMemo(
    () =>
      findingSeverityOrder
        .map((severity) => ({
          severity,
          items: relatedFindings
            .filter((item) => item.severity === severity)
            .sort((left, right) => {
              const titleCompare = left.title.localeCompare(right.title);
              if (titleCompare !== 0) {
                return titleCompare;
              }
              return left.findingId - right.findingId;
            }),
        }))
        .filter((group) => group.items.length > 0),
    [relatedFindings],
  );

  return {
    approveErrorMessage,
    errorMessage,
    finding,
    handleApprovePatch,
    handleResolutionStatusChange,
    hasPatches,
    isApprovingPatch,
    isLoading,
    isPollingPatch,
    isUpdatingResolutionStatus,
    practiceSnippet,
    rawSnippetText,
    refreshFindingData,
    relatedFindingGroups,
    relatedFindings,
    scanBasic,
  };
}

export default useFindingDetailData;
