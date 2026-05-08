import { apiClient } from '../../../api/client';
import { getApiErrorCode, getApiErrorMessage } from '../../../api/error';
import type { ApiSuccessResponse } from '../../../types/api';
import type { AgentStatusResponseData } from '../../../types/scan';

const GET_AGENT_STATUS_ERROR = '에이전트 상태를 불러오지 못했습니다.';

export async function getProjectAgentStatus(projectId: string) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<AgentStatusResponseData>>(
      `/projects/${projectId}/agent/status`,
    );
    return response.data.data;
  } catch (error) {
    const errorCode = getApiErrorCode(error);

    if (errorCode === 'NOT_FOUND') {
      return null;
    }

    throw new Error(getApiErrorMessage(error, GET_AGENT_STATUS_ERROR));
  }
}
