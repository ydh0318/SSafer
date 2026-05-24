import { useEffect, useMemo, useRef, useState } from 'react';

import { useProjectStore } from '../../../store/projectStore';
import type {
  AgentStatusResponseData,
  ProjectScanListItemData,
} from '../../../types/scan';
import { getProjectAgentStatus } from '../../agents/api/agents';
import { getProjectScans } from '../../scans/api/scans';
import { useScanEventSubscription } from '../../scans/hooks/useScanEventSubscription';
import { getProjects } from '../api/projects';

export type ProjectLatestCompletedScan = {
  projectId: string;
  projectName: string;
  scan: ProjectScanListItemData;
};

type LatestCompletedScanMap = Record<string, ProjectLatestCompletedScan>;
type AgentStatusMap = Record<string, AgentStatusResponseData | null>;

function useProjectOverviewData() {
  const projects = useProjectStore((state) => state.projects);
  const setProjectsFromList = useProjectStore((state) => state.setProjectsFromList);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [agentStatusMap, setAgentStatusMap] = useState<AgentStatusMap>({});
  const [latestCompletedScans, setLatestCompletedScans] = useState<LatestCompletedScanMap>({});
  const [completedScansRefreshKey, setCompletedScansRefreshKey] = useState(0);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useScanEventSubscription(
    () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        setCompletedScansRefreshKey((current) => current + 1);
      }, 500);
    },
    () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        setCompletedScansRefreshKey((current) => current + 1);
      }, 500);
    },
  );

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const data = await getProjects();

        if (!isMounted) {
          return;
        }

        setProjectsFromList(data.items, data.totalElements, data.totalPages);
      } catch (error) {
        console.error('Failed to load projects.', error);

        if (isMounted) {
          setLoadError('Failed to load projects. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProjects();

    return () => {
      isMounted = false;
    };
  }, [setProjectsFromList]);

  const projectIdsKey = useMemo(() => projects.map((project) => project.id).join(','), [projects]);

  useEffect(() => {
    if (projects.length === 0) {
      return;
    }

    let isMounted = true;
    const targetProjects = projects.slice();

    void (async () => {
      const entries = await Promise.all(
        targetProjects.map(async (project) => {
          const status = await getProjectAgentStatus(project.id).catch(() => null);
          return [project.id, status] as const;
        }),
      );

      if (isMounted) {
        setAgentStatusMap(Object.fromEntries(entries));
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [projectIdsKey, projects]);

  useEffect(() => {
    if (projects.length === 0) {
      return;
    }

    let isMounted = true;

    const loadCompletedScans = async () => {
      try {
        const scanResponses = await Promise.all(
          projects.map(async (project) => {
            const response = await getProjectScans(project.id, { page: 0, size: 10 });
            const latestDoneScan = response.items
              .filter((scan) => scan.status === 'DONE')
              .sort((left, right) => {
                const leftTime = new Date(left.completedAt ?? left.requestedAt).getTime();
                const rightTime = new Date(right.completedAt ?? right.requestedAt).getTime();
                return rightTime - leftTime;
              })[0];

            if (!latestDoneScan) {
              return null;
            }

            return {
              projectId: project.id,
              projectName: project.name,
              scan: latestDoneScan,
            };
          }),
        );

        if (!isMounted) {
          return;
        }

        const nextMap = scanResponses.reduce<LatestCompletedScanMap>((accumulator, item) => {
          if (item) {
            accumulator[item.projectId] = item;
          }

          return accumulator;
        }, {});

        setLatestCompletedScans(nextMap);
      } catch (error) {
        console.error('Failed to load latest completed scans.', error);

        if (isMounted) {
          setLatestCompletedScans({});
        }
      }
    };

    void loadCompletedScans();

    return () => {
      isMounted = false;
    };
  }, [completedScansRefreshKey, projects]);

  const stableAgentStatusMap = projects.length === 0 ? {} : agentStatusMap;
  const stableLatestCompletedScans = projects.length === 0 ? {} : latestCompletedScans;

  return {
    agentStatusMap: stableAgentStatusMap,
    isLoading,
    latestCompletedScans: stableLatestCompletedScans,
    loadError,
    projects,
  };
}

export default useProjectOverviewData;
