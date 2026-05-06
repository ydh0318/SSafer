import { apiClient } from '../../../api/client';
import { getApiErrorCode, getApiErrorMessage } from '../../../api/error';
import type { ApiSuccessResponse } from '../../../types/api';
import type {
  CreateScanRequestPayload,
  CreateScanResponseData,
  DeleteScanHistoryResponseData,
  ProjectScanListQuery,
  ProjectScanListResponseData,
  RawScanUploadReportData,
  ScanProgressStatusData,
} from '../../../types/scan';

const CREATE_SCAN_ERROR = '스캔 요청을 생성하지 못했습니다.';
const GET_PROJECT_SCANS_ERROR = '프로젝트 스캔 목록을 불러오지 못했습니다.';
const GET_SCAN_STATUS_ERROR = '스캔 상태를 불러오지 못했습니다.';
const UPLOAD_SCAN_FILE_ERROR = '스캔 결과 파일을 업로드하지 못했습니다.';
const REPORT_SCAN_UPLOAD_ERROR = '업로드된 스캔 결과를 보고하지 못했습니다.';

export async function createScanRequest(payload: CreateScanRequestPayload) {
  try {
    const response = await apiClient.post<ApiSuccessResponse<CreateScanResponseData>>('/scans', payload);
    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, CREATE_SCAN_ERROR));
  }
}

export async function getProjectScans(projectId: string, query: ProjectScanListQuery = {}) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<ProjectScanListResponseData>>(
      `/projects/${projectId}/scans`,
      {
        params: {
          page: query.page ?? 0,
          size: query.size ?? 20,
          status: query.status || undefined,
          scanMode: query.scanMode || undefined,
        },
      },
    );

    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, GET_PROJECT_SCANS_ERROR));
  }
}

export async function getScanStatus(scanId: string) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<ScanProgressStatusData>>(`/scans/${scanId}/status`);
    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, GET_SCAN_STATUS_ERROR));
  }
}

export async function deleteScanHistory(scanId: string | number) {
  try {
    const response = await apiClient.delete<ApiSuccessResponse<DeleteScanHistoryResponseData>>(`/scans/${scanId}`);
    return response.data.data;
  } catch (error) {
    const errorCode = getApiErrorCode(error);

    if (errorCode === 'INVALID_PARAMETER') {
      throw new Error('잘못된 스캔 ID입니다.');
    }

    if (errorCode === 'FORBIDDEN') {
      throw new Error('이 스캔을 삭제할 권한이 없습니다.');
    }

    if (errorCode === 'NOT_FOUND') {
      throw new Error('스캔이 존재하지 않거나 이미 삭제되었습니다.');
    }

    if (errorCode === 'SCAN_STATUS_CONFLICT') {
      throw new Error('현재 스캔 상태에서는 삭제할 수 없습니다.');
    }

    throw new Error(getApiErrorMessage(error, '스캔 이력을 삭제하지 못했습니다.'));
  }
}

function countUploadedResults(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return 1;
  }

  if ('findings' in payload && Array.isArray(payload.findings)) {
    return payload.findings.length;
  }

  if ('items' in payload && Array.isArray(payload.items)) {
    return payload.items.length;
  }

  return 1;
}

async function createSha256Hash(file: File) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((value) => value.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex}`;
}

export async function uploadScanResultFile(rawUploadUrl: string, file: File) {
  try {
    const response = await fetch(rawUploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/json',
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`${UPLOAD_SCAN_FILE_ERROR} (HTTP ${response.status})`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message || UPLOAD_SCAN_FILE_ERROR);
    }

    throw new Error(UPLOAD_SCAN_FILE_ERROR);
  }
}

export async function reportUploadedScanResult(scanId: number, file: File) {
  try {
    let resultCount = 1;

    try {
      const jsonText = await file.text();
      const parsed = JSON.parse(jsonText) as unknown;
      resultCount = countUploadedResults(parsed);
    } catch {
      resultCount = 1;
    }

    const payloadHash = await createSha256Hash(file);
    const response = await apiClient.post<ApiSuccessResponse<RawScanUploadReportData>>(
      `/scans/${scanId}/raw-results`,
      {
        tool: 'ssafer-web',
        toolVersion: '1.0.0',
        resultCount,
        payloadHash,
      },
    );

    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, REPORT_SCAN_UPLOAD_ERROR));
  }
}
