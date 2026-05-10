import axios from 'axios';

import { apiClient } from '../../../api/client';
import { getApiErrorCode, getApiErrorMessage } from '../../../api/error';
import type { ApiErrorResponse, ApiSuccessResponse } from '../../../types/api';
import type {
  ApproveFindingPatchResponseData,
  CreateScanRequestPayload,
  CreateScanRequestResponseData,
  ProjectScanListQuery,
  ProjectScanListResponseData,
  ProjectScanOptionsData,
  ScanStatusResponseData,
  UploadScanRequestPayload,
  UploadScanResponseData,
} from '../../../types/scan';
import { UploadScanRequestError } from '../utils/uploadScanFeedback';

const CREATE_SCAN_ERROR = '스캔 생성에 실패했습니다.';
const GET_SCAN_OPTIONS_ERROR = '점검 옵션을 불러오지 못했습니다.';
const GET_PROJECT_SCANS_ERROR = '프로젝트 스캔 목록을 불러오지 못했습니다.';
const GET_SCAN_STATUS_ERROR = '스캔 상태를 불러오지 못했습니다.';
const UPLOAD_SCAN_REQUEST_ERROR = '업로드 기반 점검 요청에 실패했습니다.';
const APPROVE_FINDING_PATCH_ERROR = '취약점 패치 승인에 실패했습니다.';

export async function createScanRequest(payload: CreateScanRequestPayload) {
  try {
    const response = await apiClient.post<ApiSuccessResponse<CreateScanRequestResponseData>>('/scans', payload);
    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, CREATE_SCAN_ERROR));
  }
}

export async function getProjectScanOptions(projectId: string) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<ProjectScanOptionsData>>(`/projects/${projectId}/scan-options`);
    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, GET_SCAN_OPTIONS_ERROR));
  }
}

export async function requestUploadScan(payload: UploadScanRequestPayload) {
  try {
    const formData = new FormData();

    formData.append('projectName', payload.projectName);

    if (payload.scanName?.trim()) {
      formData.append('scanName', payload.scanName.trim());
    }

    payload.files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await apiClient.post<ApiSuccessResponse<UploadScanResponseData>>('/scans/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError<ApiErrorResponse<Partial<UploadScanResponseData>>>(error)) {
      const responseData = error.response?.data;
      const uploadData = responseData?.data;

      throw new UploadScanRequestError({
        message: getApiErrorMessage(error, UPLOAD_SCAN_REQUEST_ERROR),
        code: responseData?.code ?? null,
        scanId: uploadData?.scanId ?? null,
        status: uploadData?.status ?? null,
        failureReason: uploadData?.failureReason ?? null,
      });
    }

    throw new UploadScanRequestError({
      message: getApiErrorMessage(error, UPLOAD_SCAN_REQUEST_ERROR),
    });
  }
}

export async function getProjectScans(projectId: string, query: ProjectScanListQuery = {}) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<ProjectScanListResponseData>>(`/projects/${projectId}/scans`, {
      params: {
        page: query.page ?? 0,
        size: query.size ?? 20,
        status: query.status || undefined,
        scanMode: query.scanMode || undefined,
      },
    });

    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, GET_PROJECT_SCANS_ERROR));
  }
}

export async function getScanStatus(scanId: string | number) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<ScanStatusResponseData>>(`/scans/${scanId}/status`);
    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, GET_SCAN_STATUS_ERROR));
  }
}

export async function approveFindingPatch(scanId: string | number, findingId: string | number) {
  try {
    const response = await apiClient.post<ApiSuccessResponse<ApproveFindingPatchResponseData>>(
      `/scans/${scanId}/findings/${findingId}/approve`,
    );

    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, APPROVE_FINDING_PATCH_ERROR));
  }
}

export async function deleteScanHistory(scanId: string | number) {
  try {
    await apiClient.delete(`/scans/${scanId}`);
  } catch (error) {
    const errorCode = getApiErrorCode(error);

    if (errorCode === 'INVALID_PARAMETER') {
      throw new Error('유효하지 않은 스캔 ID입니다.');
    }

    if (errorCode === 'FORBIDDEN') {
      throw new Error('이 스캔을 삭제할 권한이 없습니다.');
    }

    if (errorCode === 'NOT_FOUND') {
      throw new Error('스캔을 찾을 수 없거나 이미 삭제되었습니다.');
    }

    if (errorCode === 'SCAN_STATUS_CONFLICT') {
      throw new Error('현재 상태에서는 스캔을 삭제할 수 없습니다.');
    }

    if (errorCode === 'INTERNAL_SERVER_ERROR') {
      throw new Error('서버 문제로 스캔을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }

    throw new Error(getApiErrorMessage(error, '스캔 삭제에 실패했습니다.'));
  }
}
