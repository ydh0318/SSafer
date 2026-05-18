import axios from 'axios';

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
    // 404 / NOT_FOUND / AGENT_NOT_FOUND 모두 "Agent가 아직 연결되지 않은 정상 상태"로 처리
    const isHttp404 = axios.isAxiosError(error) && error.response?.status === 404;
    const errorCode = getApiErrorCode(error);
    const isNotFoundCode =
      errorCode === 'NOT_FOUND' || errorCode === 'AGENT_NOT_FOUND' || errorCode === 'PROJECT_AGENT_NOT_FOUND';

    if (isHttp404 || isNotFoundCode) {
      return null;
    }

    // eslint-disable-next-line preserve-caught-error
    throw new Error(getApiErrorMessage(error, GET_AGENT_STATUS_ERROR));
  }
}
