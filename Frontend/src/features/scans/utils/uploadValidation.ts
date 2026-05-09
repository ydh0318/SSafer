const MAX_SCAN_UPLOAD_FILE_SIZE_BYTES = 1 * 1024 * 1024;
const MAX_SCAN_UPLOAD_FILE_COUNT = 3;
const SCAN_UPLOAD_ALLOWED_FILE_NAME_PATTERNS = [
  /^\.env$/i,
  /^\.env\.[A-Za-z0-9_-]+$/i,
  /^Dockerfile$/i,
  /^Containerfile$/i,
  /^docker-compose(\.[A-Za-z0-9_-]+)?\.ya?ml$/i,
  /^compose(\.[A-Za-z0-9_-]+)?\.ya?ml$/i,
] as const;

export const SCAN_UPLOAD_FILE_SIZE_LIMIT_MB = 1;
export const SCAN_UPLOAD_FILE_COUNT_LIMIT = MAX_SCAN_UPLOAD_FILE_COUNT;

function isAllowedScanUploadFileName(fileName: string) {
  return SCAN_UPLOAD_ALLOWED_FILE_NAME_PATTERNS.some((pattern) => pattern.test(fileName));
}

export function validateScanUploadFiles(files: File[]) {
  if (files.length === 0) {
    return '업로드할 파일을 선택해 주세요.';
  }

  if (files.length > MAX_SCAN_UPLOAD_FILE_COUNT) {
    return `업로드 파일은 최대 ${MAX_SCAN_UPLOAD_FILE_COUNT}개까지 선택할 수 있습니다.`;
  }

  const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);

  if (totalFileSize > MAX_SCAN_UPLOAD_FILE_SIZE_BYTES) {
    return `업로드 파일의 총 용량은 ${SCAN_UPLOAD_FILE_SIZE_LIMIT_MB}MB 이하여야 합니다.`;
  }

  const emptyFile = files.find((file) => file.size === 0);

  if (emptyFile) {
    return '비어 있는 파일은 업로드할 수 없습니다.';
  }

  const unsupportedFile = files.find((file) => !isAllowedScanUploadFileName(file.name));

  if (unsupportedFile) {
    return '지원하지 않는 파일이 포함되어 있습니다.';
  }

  return null;
}

export function validateScanUploadFile(file: File | null) {
  return validateScanUploadFiles(file ? [file] : []);
}
