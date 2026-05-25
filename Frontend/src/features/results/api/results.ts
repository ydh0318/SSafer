import { apiClient } from '../../../api/client';
import { createApiError } from '../../../api/error';
import type { ApiSuccessResponse } from '../../../types/api';
import type {
  FindingOpenSummaryData,
  FindingResolutionStatus,
  FindingResolutionStatusUpdateResponseData,
  ScanBasicData,
  ScanCompareResponseData,
  ScanFindingDetailData,
  ScanFindingListQuery,
  ScanFindingListResponseData,
  ScanSummaryData,
} from '../../../types/scan';

const GET_SCAN_BASIC_ERROR = '스캔 기본 정보를 불러오지 못했습니다.';
const GET_SCAN_SUMMARY_ERROR = '스캔 요약 정보를 불러오지 못했습니다.';
const GET_SCAN_FINDINGS_ERROR = '스캔 취약점 목록을 불러오지 못했습니다.';
const GET_SCAN_FINDING_DETAIL_ERROR = '취약점 상세 정보를 불러오지 못했습니다.';
const GET_SCAN_COMPARE_ERROR = '스캔 비교 결과를 불러오지 못했습니다.';
const UPDATE_FINDING_RESOLUTION_STATUS_ERROR = '조치 결과 상태를 변경하지 못했습니다.';
const GET_OPEN_FINDING_SUMMARY_ERROR = '조치 필요 취약점 집계를 불러오지 못했습니다.';

export async function getScanBasic(scanId: string | number) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<ScanBasicData>>(`/scans/${scanId}`);
    return response.data.data;
  } catch (error) {
    throw createApiError(error, GET_SCAN_BASIC_ERROR);
  }
}

export async function getScanSummary(scanId: string | number) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<ScanSummaryData>>(`/scans/${scanId}/summary`);
    return response.data.data;
  } catch (error) {
    throw createApiError(error, GET_SCAN_SUMMARY_ERROR);
  }
}

export async function getScanFindings(scanId: string | number, query: ScanFindingListQuery = {}) {
  try {
    const params: Record<string, string | number> = {
      page: query.page ?? 0,
      size: query.size ?? 20,
    };

    if (query.severity) {
      params.severity = query.severity;
    }

    if (typeof query.category === 'string' && query.category.trim() !== '') {
      params.category = query.category.trim();
    }

    if (query.resolutionStatus) {
      params.resolutionStatus = query.resolutionStatus;
    }

    if (query.sourceType) {
      params.sourceType = query.sourceType;
    }

    if (typeof query.scanNodeId === 'number') {
      params.scanNodeId = query.scanNodeId;
    }

    const response = await apiClient.get<ApiSuccessResponse<ScanFindingListResponseData>>(
      `/scans/${scanId}/findings`,
      { params },
    );

    return response.data.data;
  } catch (error) {
    throw createApiError(error, GET_SCAN_FINDINGS_ERROR);
  }
}

export async function getScanFindingDetail(scanId: string | number, findingId: string | number) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<ScanFindingDetailData>>(
      `/scans/${scanId}/findings/${findingId}`,
    );
    return response.data.data;
  } catch (error) {
    throw createApiError(error, GET_SCAN_FINDING_DETAIL_ERROR);
  }
}

export async function getScanCompare(baseScanId: string | number, targetScanId: string | number) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<ScanCompareResponseData>>('/scans/compare', {
      params: {
        baseScanId,
        targetScanId,
      },
    });

    return response.data.data;
  } catch (error) {
    throw createApiError(error, GET_SCAN_COMPARE_ERROR);
  }
}

export async function updateFindingResolutionStatus(
  findingId: string | number,
  status: FindingResolutionStatus,
) {
  try {
    const response = await apiClient.patch<ApiSuccessResponse<FindingResolutionStatusUpdateResponseData>>(
      `/findings/${findingId}/resolution-status`,
      { status },
    );
    return response.data.data;
  } catch (error) {
    throw createApiError(error, UPDATE_FINDING_RESOLUTION_STATUS_ERROR);
  }
}

export async function getOpenFindingSummary(projectId?: string | number) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<FindingOpenSummaryData>>('/findings/open-summary', {
      params: projectId === undefined ? undefined : { projectId },
    });
    return response.data.data;
  } catch (error) {
    throw createApiError(error, GET_OPEN_FINDING_SUMMARY_ERROR);
  }
}
