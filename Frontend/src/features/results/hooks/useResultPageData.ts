import { useEffect, useMemo, useState } from 'react';

import type {
  FindingResolutionStatus,
  FindingSeverity,
  ScanBasicData,
  ScanFindingDetailData,
  ScanFindingListItemData,
  ScanFindingListResponseData,
  ScanSummaryData,
} from '../../../types/scan';
import { useToast } from '../../feedback/useToast';
import { getProjectDetail } from '../../projects/api/projects';
import { getSafeScanType } from '../../scans/utils/scanPresentation';
import {
  getScanBasic,
  getScanFindingDetail,
  getScanFindings,
  getScanSummary,
  updateFindingResolutionStatus,
} from '../api/results';
import { getResolutionCount, groupFindingsByTitle, severityOrder } from '../utils/resultPresentation';

const emptyFindingList: ScanFindingListResponseData = {
  items: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

type ResultPageRouteState = {
  projectId?: string;
};

function useResultPageData(scanId: string, routeState: ResultPageRouteState) {
  const toast = useToast();

  const [scanBasic, setScanBasic] = useState<ScanBasicData | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummaryData | null>(null);
  const [findingsData, setFindingsData] = useState<ScanFindingListResponseData>(emptyFindingList);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFindingsLoading, setIsFindingsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uiState, setUiState] = useState<{
    page: number;
    resolutionFilter: 'all' | FindingResolutionStatus;
    scanId: string;
    severityFilter: 'all' | FindingSeverity;
  }>({
    page: 0,
    resolutionFilter: 'all',
    scanId,
    severityFilter: 'all',
  });
  const [serverAuditDetailsState, setServerAuditDetailsState] = useState<{
    key: string;
    map: Map<number, ScanFindingDetailData>;
  } | null>(null);
  const [expandedGroupsState, setExpandedGroupsState] = useState<{
    key: string;
    value: Set<string>;
  }>({
    key: `${scanId}:0:all:all`,
    value: new Set(),
  });
  const [updatingStatusFindingIds, setUpdatingStatusFindingIds] = useState<number[]>([]);
  const currentUiState =
    uiState.scanId === scanId
      ? uiState
      : {
          page: 0,
          resolutionFilter: 'all' as const,
          scanId,
          severityFilter: 'all' as const,
        };
  const severityFilter = currentUiState.severityFilter;
  const resolutionFilter = currentUiState.resolutionFilter;
  const page = currentUiState.page;
  const expandedGroupsKey = `${scanId}:${page}:${severityFilter}:${resolutionFilter}`;
  const expandedFindingGroups =
    expandedGroupsState.key === expandedGroupsKey ? expandedGroupsState.value : new Set<string>();

  const refreshOverview = async () => {
    if (!scanId) {
      return;
    }

    setIsInitialLoading(true);
    setErrorMessage(null);

    try {
      const basicData = await getScanBasic(scanId);
      setScanBasic(basicData);

      void getProjectDetail(String(basicData.projectId))
        .then((project) => {
          setProjectName(project.name);
        })
        .catch(() => {});

      const summaryData = await getScanSummary(scanId);
      setSummary(summaryData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '스캔 결과를 불러오지 못했습니다.');
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    if (!scanId) {
      return;
    }

    let isMounted = true;

    const loadOverview = async () => {
      setIsInitialLoading(true);
      setErrorMessage(null);

      try {
        const basicData = await getScanBasic(scanId);

        if (!isMounted) {
          return;
        }

        setScanBasic(basicData);

        void getProjectDetail(String(basicData.projectId))
          .then((project) => {
            if (isMounted) {
              setProjectName(project.name);
            }
          })
          .catch(() => {});

        const summaryData = await getScanSummary(scanId);

        if (isMounted) {
          setSummary(summaryData);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : '스캔 결과를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    };

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, [scanId]);

  useEffect(() => {
    if (!scanId) {
      return;
    }

    let isMounted = true;

    const loadFindings = async () => {
      setIsFindingsLoading(true);
      setErrorMessage(null);

      try {
        const isServerAudit = getSafeScanType(scanBasic?.scanType) === 'SERVER_AUDIT';
        const data = await getScanFindings(scanId, {
          severity: severityFilter === 'all' ? undefined : severityFilter,
          resolutionStatus: resolutionFilter === 'all' ? undefined : resolutionFilter,
          page,
          size: isServerAudit ? 100 : 20,
        });

        if (isMounted) {
          setFindingsData(data);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : '취약점 목록을 불러오지 못했습니다.');
          setFindingsData(emptyFindingList);
        }
      } finally {
        if (isMounted) {
          setIsFindingsLoading(false);
        }
      }
    };

    void loadFindings();

    return () => {
      isMounted = false;
    };
  }, [page, resolutionFilter, scanBasic?.scanType, scanId, severityFilter]);

  useEffect(() => {
    if (!scanId || findingsData.items.length === 0) {
      return;
    }

    let isMounted = true;
    const detailKey = `${scanId}:${findingsData.items.map((item) => item.findingId).join(',')}`;

    const fetchDetails = async () => {
      const settled = await Promise.allSettled(
        findingsData.items.map((item) => getScanFindingDetail(scanId, item.findingId)),
      );

      if (!isMounted) {
        return;
      }

      const map = new Map<number, ScanFindingDetailData>();
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const finding = findingsData.items[index];
          if (finding) {
            map.set(finding.findingId, result.value);
          }
        }
      });

      setServerAuditDetailsState({
        key: detailKey,
        map,
      });
    };

    void fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [findingsData.items, scanId]);

  const detailKey = `${scanId}:${findingsData.items.map((item) => item.findingId).join(',')}`;
  const serverAuditDetails =
    serverAuditDetailsState?.key === detailKey ? serverAuditDetailsState.map : new Map<number, ScanFindingDetailData>();

  const counts = useMemo(
    () => ({
      CRITICAL: summary?.criticalCount ?? 0,
      HIGH: summary?.highCount ?? 0,
      MEDIUM: summary?.mediumCount ?? 0,
      LOW: summary?.lowCount ?? 0,
      INFO: summary?.infoCount ?? 0,
      total: summary?.totalFindings ?? 0,
    }),
    [summary],
  );

  const actionableTotal = Math.max((summary?.totalFindings ?? 0) - getResolutionCount(summary, 'IGNORED'), 1);
  const resolvedCount = getResolutionCount(summary, 'RESOLVED');
  const openCount = getResolutionCount(summary, 'OPEN');
  const inProgressCount = getResolutionCount(summary, 'IN_PROGRESS');
  const ignoredCount = getResolutionCount(summary, 'IGNORED');
  const resolvedRatio = Math.round((resolvedCount / actionableTotal) * 100);
  const routeProjectId = routeState.projectId ? Number(routeState.projectId) : undefined;
  const currentProjectId = scanBasic?.projectId ?? routeProjectId;
  const currentScanType = getSafeScanType(scanBasic?.scanType);
  const isServerAudit = currentScanType === 'SERVER_AUDIT';

  const groupedFindings = useMemo(() => {
    return severityOrder
      .map((severity) => ({
        severity,
        items: findingsData.items.filter((finding) => finding.severity === severity),
      }))
      .map((group) => ({
        ...group,
        titleGroups: groupFindingsByTitle(group.items),
      }))
      .filter((group) => group.items.length > 0);
  }, [findingsData.items]);

  const toggleFindingGroup = (groupKey: string) => {
    setExpandedGroupsState((current) => {
      const base = current.key === expandedGroupsKey ? current.value : new Set<string>();
      const next = new Set(base);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return {
        key: expandedGroupsKey,
        value: next,
      };
    });
  };

  const handleResolutionStatusChange = async (
    finding: ScanFindingListItemData,
    nextStatus: FindingResolutionStatus,
  ) => {
    if (finding.resolutionStatus === nextStatus || updatingStatusFindingIds.includes(finding.findingId)) {
      return;
    }

    const previousStatus = finding.resolutionStatus;
    setUpdatingStatusFindingIds((current) => [...current, finding.findingId]);

    try {
      await updateFindingResolutionStatus(finding.findingId, nextStatus);
      setFindingsData((current) => ({
        ...current,
        items: current.items
          .map((item) =>
            item.findingId === finding.findingId ? { ...item, resolutionStatus: nextStatus } : item,
          )
          .filter((item) => resolutionFilter === 'all' || item.resolutionStatus === resolutionFilter),
      }));
      setSummary((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          resolutionCounts: {
            ...current.resolutionCounts,
            [previousStatus]: Math.max((current.resolutionCounts?.[previousStatus] ?? 0) - 1, 0),
            [nextStatus]: (current.resolutionCounts?.[nextStatus] ?? 0) + 1,
          },
        };
      });
      toast.success('조치 상태를 변경했습니다.', { durationMs: 2000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : '조치 상태를 변경하지 못했습니다.';
      toast.error(message, { durationMs: 2500 });
    } finally {
      setUpdatingStatusFindingIds((current) => current.filter((id) => id !== finding.findingId));
    }
  };

  const setSeverityFilterWithReset = (nextSeverity: 'all' | FindingSeverity) =>
    setUiState({
      page: 0,
      resolutionFilter,
      scanId,
      severityFilter: nextSeverity,
    });
  const setResolutionFilterWithReset = (nextResolution: 'all' | FindingResolutionStatus) =>
    setUiState({
      page: 0,
      resolutionFilter: nextResolution,
      scanId,
      severityFilter,
    });
  const clearSeverityFilter = () => setSeverityFilterWithReset('all');
  const clearResolutionFilter = () => setResolutionFilterWithReset('all');
  const goToPreviousPage = () =>
    setUiState({
      page: Math.max(page - 1, 0),
      resolutionFilter,
      scanId,
      severityFilter,
    });
  const goToNextPage = () =>
    setUiState({
      page: findingsData.totalPages === 0 ? page : Math.min(page + 1, findingsData.totalPages - 1),
      resolutionFilter,
      scanId,
      severityFilter,
    });

  return {
    clearResolutionFilter,
    clearSeverityFilter,
    counts,
    currentProjectId,
    currentScanType,
    errorMessage,
    expandedFindingGroups,
    findingsData,
    goToNextPage,
    goToPreviousPage,
    groupedFindings,
    handleResolutionStatusChange,
    ignoredCount,
    inProgressCount,
    isFindingsLoading,
    isInitialLoading,
    isServerAudit,
    openCount,
    page,
    projectName,
    refreshOverview,
    resolutionFilter,
    resolvedCount,
    resolvedRatio,
    scanBasic,
    serverAuditDetails,
    setResolutionFilter: setResolutionFilterWithReset,
    setSeverityFilter: setSeverityFilterWithReset,
    severityFilter,
    summary,
    toggleFindingGroup,
    updatingStatusFindingIds,
  };
}

export default useResultPageData;
