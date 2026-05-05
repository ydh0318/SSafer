import { apiClient } from '../../../api/client';
import { getApiErrorMessage } from '../../../api/error';
import type { ApiSuccessResponse } from '../../../types/api';
import type {
  CreateScanRequestPayload,
  CreateScanResponseData,
  ProjectScanListQuery,
  ProjectScanListResponseData,
  RawScanUploadReportData,
  ScanProgressStatusData,
} from '../../../types/scan';

const CREATE_SCAN_ERROR = '스캔 요청을 등록하지 못했습니다.';
const GET_PROJECT_SCANS_ERROR = '프로젝트 스캔 목록을 불러오지 못했습니다.';
const GET_SCAN_STATUS_ERROR = '스캔 상태를 불러오지 못했습니다.';
const UPLOAD_SCAN_FILE_ERROR = '스캔 결과 파일 업로드에 실패했습니다.';
const REPORT_SCAN_UPLOAD_ERROR = '업로드 완료 보고에 실패했습니다.';

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
  const response = await fetch(rawUploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/json',
    },
    body: file,
  });

  if (!response.ok) {
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
