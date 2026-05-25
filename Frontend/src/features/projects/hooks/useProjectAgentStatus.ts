import { useEffect, useState } from 'react';

import type { AgentStatusResponseData } from '../../../types/scan';
import { getProjectAgentStatus } from '../../agents/api/agents';

type UseProjectAgentStatusOptions = {
  isGuest: boolean;
  projectId: string;
};

function useProjectAgentStatus({ isGuest, projectId }: UseProjectAgentStatusOptions) {
  const [agentStatus, setAgentStatus] = useState<AgentStatusResponseData | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [isAgentLoading, setIsAgentLoading] = useState(true);

  const refreshAgentStatus = async () => {
    if (!projectId || isGuest) {
      setAgentStatus(null);
      setAgentError(null);
      setIsAgentLoading(false);
      return;
    }

    setIsAgentLoading(true);
    setAgentError(null);

    try {
      const data = await getProjectAgentStatus(projectId);
      setAgentStatus(data);
    } catch (error) {
      setAgentStatus(null);
      setAgentError(error instanceof Error ? error.message : '에이전트 상태를 불러오지 못했습니다.');
    } finally {
      setIsAgentLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId || isGuest) {
      return;
    }

    let isMounted = true;

    const loadAgentStatus = async () => {
      setIsAgentLoading(true);
      setAgentError(null);

      try {
        const data = await getProjectAgentStatus(projectId);

        if (isMounted) {
          setAgentStatus(data);
        }
      } catch (error) {
        if (isMounted) {
          setAgentStatus(null);
          setAgentError(error instanceof Error ? error.message : '에이전트 상태를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsAgentLoading(false);
        }
      }
    };

    void loadAgentStatus();

    return () => {
      isMounted = false;
    };
  }, [isGuest, projectId]);

  return {
    agentError: isGuest ? null : agentError,
    agentStatus: isGuest ? null : agentStatus,
    isAgentLoading: isGuest ? false : isAgentLoading,
    refreshAgentStatus,
  };
}

export default useProjectAgentStatus;
