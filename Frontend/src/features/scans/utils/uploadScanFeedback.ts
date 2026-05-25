import type { ScanStatus } from '../../../types/scan';
import type { ScanUploadValidationIssue } from './uploadValidation';

export type UploadScanToastContext = 'project-create' | 'project-list' | 'project-detail';

export type UploadScanToastFeedback = {
  message: string;
  tone: 'warning' | 'error';
};

type UploadScanRequestErrorInput = {
  message: string;
  code?: string | null;
  scanId?: number | null;
  status?: ScanStatus | null;
  failureReason?: string | null;
};

export class UploadScanRequestError extends Error {
  code: string | null;
  scanId: number | null;
  status: ScanStatus | null;
  failureReason: string | null;

  constructor({ message, code = null, scanId = null, status = null, failureReason = null }: UploadScanRequestErrorInput) {
    super(message);
    this.name = 'UploadScanRequestError';
    this.code = code;
    this.scanId = scanId;
    this.status = status;
    this.failureReason = failureReason;
  }
}

export function isUploadScanRequestError(error: unknown): error is UploadScanRequestError {
  return error instanceof UploadScanRequestError;
}

export function getUploadScanValidationToastMessage(issue: ScanUploadValidationIssue | null) {
  switch (issue) {
    case 'NO_FILES':
      return '업로드할 파일을 선택해 주세요.';
    case 'FILE_COUNT_EXCEEDED':
      return '파일은 최대 3개까지 업로드할 수 있습니다.';
    case 'PAYLOAD_TOO_LARGE':
      return '전체 파일 용량은 1MB 이하만 업로드할 수 있습니다.';
    case 'EMPTY_FILE':
      return '비어 있는 파일은 업로드할 수 없습니다.';
    case 'UNSUPPORTED_FILE_TYPE':
      return '.env, Dockerfile, compose 계열 파일만 업로드할 수 있습니다.';
    default:
      return null;
  }
}

export function getUploadScanToastFeedback(error: unknown, context: UploadScanToastContext): UploadScanToastFeedback {
  if (!isUploadScanRequestError(error)) {
    return {
      tone: 'error',
      message: '파일 업로드 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }

  switch (error.code) {
    case 'INVALID_PARAMETER':
      return {
        tone: 'warning',
        message: '파일 정보나 프로젝트 정보가 올바르지 않습니다. 다시 확인해 주세요.',
      };
    case 'FILE_COUNT_EXCEEDED':
      return {
        tone: 'warning',
        message: '파일은 최대 3개까지 업로드할 수 있습니다.',
      };
    case 'UNSUPPORTED_FILE_TYPE':
      return {
        tone: 'warning',
        message: '.env, Dockerfile, compose 계열 파일만 업로드할 수 있습니다.',
      };
    case 'PAYLOAD_TOO_LARGE':
      return {
        tone: 'warning',
        message: '전체 파일 용량은 1MB 이하만 업로드할 수 있습니다.',
      };
    case 'SCAN_EXECUTION_BUSY':
      return {
        tone: 'warning',
        message: '현재 다른 스캔이 진행 중입니다. 잠시 후 다시 시도해 주세요.',
      };
    case 'ANALYSIS_QUEUE_PUBLISH_FAILED':
      return {
        tone: 'warning',
        message:
          context === 'project-create'
            ? '프로젝트는 생성되었지만 첫 스캔 준비 중 문제가 발생했습니다. 잠시 후 프로젝트 상세에서 다시 시도해 주세요.'
            : '분석 작업을 준비하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      };
    case 'RAW_RESULT_UPLOAD_FAILED':
      return {
        tone: 'error',
        message: '업로드한 파일을 분석 서버로 전달하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      };
    case 'SCAN_EXECUTION_FAILED':
      return {
        tone: 'error',
        message: '스캔 실행 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      };
    default:
      return {
        tone: 'error',
        message: error.message && error.message.trim().length > 0 ? error.message : '파일 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      };
  }
}
