const MAX_SCAN_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_SCAN_UPLOAD_MIME_TYPES = new Set(['application/json', 'text/json']);

export const SCAN_UPLOAD_FILE_SIZE_LIMIT_MB = 10;

export function validateScanUploadFile(file: File | null) {
  if (!file) {
    return '업로드할 JSON 파일을 선택해주세요.';
  }

  if (file.size === 0) {
    return '비어 있는 파일은 업로드할 수 없습니다.';
  }

  if (file.size > MAX_SCAN_UPLOAD_FILE_SIZE_BYTES) {
    return `업로드 파일은 ${SCAN_UPLOAD_FILE_SIZE_LIMIT_MB}MB 이하만 가능합니다.`;
  }

  const normalizedName = file.name.toLowerCase();
  const hasJsonExtension = normalizedName.endsWith('.json');
  const hasAllowedMimeType = !file.type || ALLOWED_SCAN_UPLOAD_MIME_TYPES.has(file.type);

  if (!hasJsonExtension && !hasAllowedMimeType) {
    return 'JSON 형식의 파일만 업로드할 수 있습니다.';
  }

  return null;
}
