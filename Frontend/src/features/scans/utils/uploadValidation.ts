const SCAN_UPLOAD_ALLOWED_FILE_NAME_PATTERNS = [
  /^\.env(?:\..+)?$/i,
  /^dockerfile(?:\..+)?$/i,
  /^containerfile(?:\..+)?$/i,
  /^docker-compose(?:\..+)?\.(?:ya?ml)$/i,
  /^compose(?:\..+)?\.(?:ya?ml)$/i,
];

const MAX_SCAN_UPLOAD_FILE_COUNT = 3;
const MAX_SCAN_UPLOAD_FILE_SIZE_BYTES = 1 * 1024 * 1024;

export const SCAN_UPLOAD_FILE_SIZE_LIMIT_MB = 1;
export const SCAN_UPLOAD_FILE_COUNT_LIMIT = MAX_SCAN_UPLOAD_FILE_COUNT;

export type ScanUploadValidationIssue =
  | 'NO_FILES'
  | 'FILE_COUNT_EXCEEDED'
  | 'PAYLOAD_TOO_LARGE'
  | 'EMPTY_FILE'
  | 'UNSUPPORTED_FILE_TYPE';

function isAllowedScanUploadFileName(fileName: string) {
  return SCAN_UPLOAD_ALLOWED_FILE_NAME_PATTERNS.some((pattern) => pattern.test(fileName));
}

export function getScanUploadValidationIssue(files: File[]): ScanUploadValidationIssue | null {
  if (files.length === 0) {
    return 'NO_FILES';
  }

  if (files.length > MAX_SCAN_UPLOAD_FILE_COUNT) {
    return 'FILE_COUNT_EXCEEDED';
  }

  const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);

  if (totalFileSize > MAX_SCAN_UPLOAD_FILE_SIZE_BYTES) {
    return 'PAYLOAD_TOO_LARGE';
  }

  const emptyFile = files.find((file) => file.size === 0);

  if (emptyFile) {
    return 'EMPTY_FILE';
  }

  const unsupportedFile = files.find((file) => !isAllowedScanUploadFileName(file.name));

  if (unsupportedFile) {
    return 'UNSUPPORTED_FILE_TYPE';
  }

  return null;
}

export function validateScanUploadFiles(files: File[]) {
  const issue = getScanUploadValidationIssue(files);

  if (issue === 'NO_FILES') {
    return '업로드할 파일을 선택해 주세요.';
  }

  if (issue === 'FILE_COUNT_EXCEEDED') {
    return `업로드 파일은 최대 ${MAX_SCAN_UPLOAD_FILE_COUNT}개까지만 선택할 수 있습니다.`;
  }

  if (issue === 'PAYLOAD_TOO_LARGE') {
    return `업로드 파일의 총 용량은 ${SCAN_UPLOAD_FILE_SIZE_LIMIT_MB}MB 이하여야 합니다.`;
  }

  if (issue === 'EMPTY_FILE') {
    return '비어 있는 파일은 업로드할 수 없습니다.';
  }

  if (issue === 'UNSUPPORTED_FILE_TYPE') {
    return '지원하지 않는 파일 형식이 포함되어 있습니다.';
  }

  return null;
}
