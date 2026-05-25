import { apiClient } from '../../../api/client';
import { createApiError } from '../../../api/error';
import type { ApiSuccessResponse } from '../../../types/api';
import type { HistoryScanListQuery, HistoryScanListResponseData } from '../../../types/scan';

const GET_HISTORY_SCANS_ERROR = '히스토리 스캔 목록을 불러오지 못했습니다.';

export async function getHistoryScans(query: HistoryScanListQuery = {}) {
  try {
    const params: Record<string, string | number> = {
      page: query.page ?? 0,
      size: query.size ?? 20,
    };

    if (typeof query.projectId === 'number') {
      params.projectId = query.projectId;
    }

    if (query.status) {
      params.status = query.status;
    }

    if (query.scanMode) {
      params.scanMode = query.scanMode;
    }

    const response = await apiClient.get<ApiSuccessResponse<HistoryScanListResponseData>>('/history/scans', {
      params,
    });

    return response.data.data;
  } catch (error) {
    throw createApiError(error, GET_HISTORY_SCANS_ERROR);
  }
}
