import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ProjectListItemData } from '../../../types/project';
import type { AgentStatus, AgentStatusResponseData } from '../../../types/scan';
import { getProjectAgentStatus } from '../../agents/api/agents';
import { getProjects } from '../../projects/api/projects';

const agentStatusColorMap: Record<AgentStatus, string> = {
  ONLINE: 'text-[#0A8F4E]',
  ERROR: 'text-[#FF8A33]',
  OFFLINE: 'text-neutral-400',
};

function normalizeMonitorErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : '';
  const isAuthError = /authentication|token|unauthorized|인증|권한/i.test(raw);

  if (isAuthError) {
    return '로그인 세션이 만료되었습니다. 페이지를 새로고침하거나 다시 로그인해 주세요.';
  }

  return '에이전트 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

function useMonitorData() {
  const [projects, setProjects] = useState<ProjectListItemData[]>([]);
  const [agentStatusMap, setAgentStatusMap] = useState<Record<number, AgentStatusResponseData | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async (signal?: { cancelled: boolean }) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const projectData = await getProjects({ size: 100 });

      if (signal?.cancelled) {
        return;
      }

      setProjects(projectData.items);

      const statusEntries = await Promise.all(
        projectData.items.map(async (project) => {
          const status = await getProjectAgentStatus(String(project.projectId)).catch(() => null);
          return [project.projectId, status] as const;
        }),
      );

      if (signal?.cancelled) {
        return;
      }

      setAgentStatusMap(Object.fromEntries(statusEntries));
    } catch (error) {
      if (signal?.cancelled) {
        return;
      }

      setErrorMessage(normalizeMonitorErrorMessage(error));
    } finally {
      if (!signal?.cancelled) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };

    const loadInitialData = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const projectData = await getProjects({ size: 100 });

        if (signal.cancelled) {
          return;
        }

        setProjects(projectData.items);

        const statusEntries = await Promise.all(
          projectData.items.map(async (project) => {
            const status = await getProjectAgentStatus(String(project.projectId)).catch(() => null);
            return [project.projectId, status] as const;
          }),
        );

        if (signal.cancelled) {
          return;
        }

        setAgentStatusMap(Object.fromEntries(statusEntries));
      } catch (error) {
        if (signal.cancelled) {
          return;
        }

        setErrorMessage(normalizeMonitorErrorMessage(error));
      } finally {
        if (!signal.cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      signal.cancelled = true;
    };
  }, []);

  const agentStatuses = useMemo(() => Object.values(agentStatusMap), [agentStatusMap]);
  const onlineCount = useMemo(
    () => agentStatuses.filter((status) => status?.status === 'ONLINE').length,
    [agentStatuses],
  );
  const runningTaskCount = useMemo(
    () => agentStatuses.filter((status) => Boolean(status?.currentTaskType)).length,
    [agentStatuses],
  );

  return {
    agentStatusColorMap,
    agentStatusMap,
    errorMessage,
    isLoading,
    loadData,
    onlineCount,
    projects,
    runningTaskCount,
  };
}

export default useMonitorData;
