import { useEffect, useMemo, useState } from 'react';

import type { ProjectSummary } from '../../../types/project';
import type {
  HistoryScanListItemData,
  HistoryScanListResponseData,
  ScanMode,
} from '../../../types/scan';
import { getProjects } from '../../projects/api/projects';
import { deleteScanHistory } from '../../scans/api/scans';
import { useScanEventSubscription } from '../../scans/hooks/useScanEventSubscription';
import { getSafeScanType } from '../../scans/utils/scanPresentation';
import { getHistoryScans } from '../api/history';

export const HISTORY_PAGE_SIZE = 10;

export type HistoryFilters = {
  scanMode?: ScanMode | '';
  status?: 'DONE' | 'FAILED' | '';
  projectId?: string;
};

export const emptyHistoryData: HistoryScanListResponseData = {
  summary: {
    totalScanCount: 0,
    totalFindingCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
  },
  items: [],
  page: 0,
  size: HISTORY_PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
};

function toHistoryProjectId(projectId?: string) {
  if (!projectId) {
    return undefined;
  }

  const parsedProjectId = Number(projectId);
  return Number.isFinite(parsedProjectId) ? parsedProjectId : undefined;
}

function buildStoredProjectNameMap(storedProjects: ProjectSummary[]) {
  return storedProjects.reduce<Record<number, string>>((accumulator, project) => {
    accumulator[Number(project.id)] = project.name;
    return accumulator;
  }, {});
}

function buildProjectFilterOptions(
  historyItems: HistoryScanListItemData[],
  projectNameMap: Record<number, string>,
) {
  const projects = new Map<number, string>();

  Object.entries(projectNameMap).forEach(([projectId, projectName]) => {
    const numericProjectId = Number(projectId);
    if (Number.isFinite(numericProjectId)) {
      projects.set(numericProjectId, projectName);
    }
  });

  historyItems.forEach((item) => {
    projects.set(item.projectId, projectNameMap[item.projectId] ?? `프로젝트 ${item.projectId}`);
  });

  const nameCounts = Array.from(projects.values()).reduce<Record<string, number>>((accumulator, projectName) => {
    accumulator[projectName] = (accumulator[projectName] ?? 0) + 1;
    return accumulator;
  }, {});

  return Array.from(projects.entries())
    .map(([projectId, projectName]) => ({
      projectId: String(projectId),
      projectName: nameCounts[projectName] > 1 ? `${projectName} (#${projectId})` : projectName,
    }))
    .sort((left, right) => left.projectName.localeCompare(right.projectName));
}

function useHistoryData(canAccessHistory: boolean, storedProjects: ProjectSummary[]) {
  const [filterScanMode, setFilterScanMode] = useState<ScanMode | ''>('');
  const [filterStatus, setFilterStatus] = useState<'DONE' | 'FAILED' | ''>('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [historyData, setHistoryData] = useState<HistoryScanListResponseData>(emptyHistoryData);
  const [fetchedProjectNameMap, setFetchedProjectNameMap] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [deletingScanIds, setDeletingScanIds] = useState<number[]>([]);

  const projectNameMap = useMemo(
    () => ({
      ...fetchedProjectNameMap,
      ...buildStoredProjectNameMap(storedProjects),
    }),
    [fetchedProjectNameMap, storedProjects],
  );

  const visibleHistoryItems = useMemo(
    () =>
      filterProjectId
        ? historyData.items.filter((item) => String(item.projectId) === filterProjectId)
        : historyData.items,
    [filterProjectId, historyData.items],
  );

  const doneHistoryItems = useMemo(
    () => visibleHistoryItems.filter((item) => item.status === 'DONE' && getSafeScanType(item.scanType) === 'PROJECT_FILE'),
    [visibleHistoryItems],
  );

  const projectFilterOptions = useMemo(
    () => buildProjectFilterOptions(historyData.items, projectNameMap),
    [historyData.items, projectNameMap],
  );

  const loadHistory = async (params?: HistoryFilters) => {
    if (!canAccessHistory) {
      return null;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const projectId = toHistoryProjectId(params?.projectId);
      const data = await getHistoryScans({
        page: 0,
        size: HISTORY_PAGE_SIZE,
        ...(params?.scanMode && { scanMode: params.scanMode }),
        ...(params?.status && { status: params.status }),
        ...(typeof projectId === 'number' && { projectId }),
      });

      setHistoryData(data);
      return data;
    } catch (error) {
      setHistoryData(emptyHistoryData);
      setErrorMessage(error instanceof Error ? error.message : '스캔 이력을 불러오지 못했습니다.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccessHistory) {
      return;
    }

    let isMounted = true;

    const loadProjectOptions = async () => {
      const pageSize = 100;
      const firstPage = await getProjects({ page: 0, size: pageSize });
      const allProjects = [...firstPage.items];

      for (let page = 1; page < firstPage.totalPages; page += 1) {
        const pageData = await getProjects({ page, size: pageSize });
        allProjects.push(...pageData.items);
      }

      return allProjects;
    };

    void loadProjectOptions()
      .then((projects) => {
        if (!isMounted) {
          return;
        }

        setFetchedProjectNameMap(
          projects.reduce<Record<number, string>>((accumulator, project) => {
            accumulator[Number(project.projectId)] = project.name;
            return accumulator;
          }, {}),
        );
      })
      .catch(() => {
        if (isMounted) {
          setFetchedProjectNameMap({});
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canAccessHistory]);

  useEffect(() => {
    if (!canAccessHistory) {
      return;
    }

    let isMounted = true;

    const initializeHistory = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getHistoryScans({ page: 0, size: HISTORY_PAGE_SIZE });
        if (!isMounted) {
          return;
        }

        setHistoryData(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setHistoryData(emptyHistoryData);
        setErrorMessage(error instanceof Error ? error.message : '스캔 이력을 불러오지 못했습니다.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initializeHistory();

    return () => {
      isMounted = false;
    };
  }, [canAccessHistory]);

  const handleFilterChange = (scanMode: ScanMode | '', status: 'DONE' | 'FAILED' | '', projectId = filterProjectId) => {
    setFilterScanMode(scanMode);
    setFilterStatus(status);
    setFilterProjectId(projectId);
    void loadHistory({ scanMode, status, projectId });
  };

  const handleRefresh = async () => {
    if (!canAccessHistory) {
      return;
    }

    setNoticeMessage(null);
    await loadHistory({ scanMode: filterScanMode, status: filterStatus, projectId: filterProjectId });
  };

  const activeProjectNameMap = canAccessHistory ? projectNameMap : {};
  const activeProjectFilterOptions = canAccessHistory ? projectFilterOptions : [];
  const activeHistoryData = canAccessHistory ? historyData : emptyHistoryData;
  const activeVisibleHistoryItems = canAccessHistory ? visibleHistoryItems : [];
  const activeDoneHistoryItems = canAccessHistory ? doneHistoryItems : [];
  const activeDeletingScanIds = canAccessHistory ? deletingScanIds : [];

  useScanEventSubscription(
    () => {
      if (canAccessHistory) {
        void handleRefresh();
      }
    },
    () => {
      if (canAccessHistory) {
        void handleRefresh();
      }
    },
  );

  const handleDeleteScan = async (scanId: number) => {
    const shouldDelete = window.confirm(`스캔 #${scanId} 이력을 삭제하시겠습니까?`);
    if (!shouldDelete) {
      return;
    }

    setDeletingScanIds((current) => [...current, scanId]);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      await deleteScanHistory(scanId);
      setNoticeMessage(`스캔 #${scanId} 이력을 삭제했습니다.`);
      await loadHistory({ scanMode: filterScanMode, status: filterStatus, projectId: filterProjectId });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '스캔 이력을 삭제하지 못했습니다.');
      setNoticeMessage(null);
    } finally {
      setDeletingScanIds((current) => current.filter((value) => value !== scanId));
    }
  };

  return {
    deletingScanIds: activeDeletingScanIds,
    doneHistoryItems: activeDoneHistoryItems,
    errorMessage: canAccessHistory ? errorMessage : null,
    filterProjectId,
    filterScanMode,
    filterStatus,
    handleDeleteScan,
    handleFilterChange,
    handleRefresh,
    historyData: activeHistoryData,
    isLoading,
    noticeMessage: canAccessHistory ? noticeMessage : null,
    projectFilterOptions: activeProjectFilterOptions,
    projectNameMap: activeProjectNameMap,
    visibleHistoryItems: activeVisibleHistoryItems,
  };
}

export default useHistoryData;
