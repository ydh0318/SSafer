import { Terminal, Upload } from 'lucide-react';

import type { CreateScanRequestPayload } from '../../../types/scan';
import { SCAN_UPLOAD_FILE_COUNT_LIMIT, SCAN_UPLOAD_FILE_SIZE_LIMIT_MB } from '../utils/uploadValidation';

export type ScanRequestMethod = 'AGENT' | 'UPLOAD';

type ScanRequestFormProps = {
  value: CreateScanRequestPayload;
  scanRequestMethod: ScanRequestMethod;
  agentAvailable?: boolean;
  selectedFiles: File[];
  isSubmitting: boolean;
  errorMessage: string | null;
  onChange: (nextValue: CreateScanRequestPayload) => void;
  onMethodChange: (nextValue: ScanRequestMethod) => void;
  onFileChange: (files: File[]) => void;
  onSubmit: () => void;
};

function ScanRequestForm({
  value,
  scanRequestMethod,
  agentAvailable = true,
  selectedFiles,
  isSubmitting,
  errorMessage,
  onChange,
  onMethodChange,
  onFileChange,
  onSubmit,
}: ScanRequestFormProps) {
  const handleFieldChange = <Key extends keyof CreateScanRequestPayload>(
    key: Key,
    nextValue: CreateScanRequestPayload[Key],
  ) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <button
          className={`border px-4 py-4 text-left transition ${
            scanRequestMethod === 'AGENT'
              ? 'border-black bg-black text-white'
              : 'border-neutral-300 bg-white text-black hover:border-black'
          } ${agentAvailable ? '' : 'cursor-not-allowed opacity-40'}`}
          disabled={!agentAvailable}
          onClick={() => onMethodChange('AGENT')}
          type="button"
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <p className="text-sm font-black">에이전트 기반 스캔</p>
          </div>
          <p className={`mt-2 text-xs leading-6 ${scanRequestMethod === 'AGENT' ? 'text-neutral-300' : 'text-neutral-500'}`}>
            연결된 Local Agent가 있으면 프로젝트 서버에서 바로 점검 작업을 시작할 수 있습니다.
          </p>
        </button>
        <button
          className={`border px-4 py-4 text-left transition ${
            scanRequestMethod === 'UPLOAD'
              ? 'border-black bg-black text-white'
              : 'border-neutral-300 bg-white text-black hover:border-black'
          }`}
          onClick={() => onMethodChange('UPLOAD')}
          type="button"
        >
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <p className="text-sm font-black">업로드 기반 스캔</p>
          </div>
          <p className={`mt-2 text-xs leading-6 ${scanRequestMethod === 'UPLOAD' ? 'text-neutral-300' : 'text-neutral-500'}`}>
            설정 파일을 업로드하면 서버가 바로 점검을 시작하고 분석 큐까지 이어서 처리합니다.
          </p>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-black">프로젝트 이름</span>
          <input
            className="w-full border border-neutral-300 bg-[#f7f7f7] px-4 py-3 text-sm text-neutral-600 outline-none"
            readOnly
            type="text"
            value={value.projectName}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-black">분석 소스</span>
          <select
            className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black"
            onChange={(event) => handleFieldChange('source', event.target.value as CreateScanRequestPayload['source'])}
            value={value.source ?? 'CLI'}
          >
            <option value="CLI">CLI</option>
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-black">스캔 이름</span>
          <input
            className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black"
            onChange={(event) => handleFieldChange('scanName', event.target.value)}
            placeholder="예: 운영 환경 설정 점검"
            type="text"
            value={value.scanName ?? ''}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-black">대상 경로</span>
          <input
            className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black"
            onChange={(event) => handleFieldChange('targetPath', event.target.value)}
            placeholder="/opt/app"
            type="text"
            value={value.targetPath ?? ''}
          />
        </label>
      </div>

      {scanRequestMethod === 'UPLOAD' ? (
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-black">설정 파일</span>
          <input
            className="w-full border border-dashed border-neutral-300 bg-[#fafafa] px-4 py-4 text-sm text-black outline-none transition file:mr-4 file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:border-black"
            multiple
            onChange={(event) => onFileChange(Array.from(event.target.files ?? []))}
            type="file"
          />
          <p className="text-xs leading-6 text-neutral-500">
            허용 파일: .env, .env.local 같은 .env.*, Dockerfile, Containerfile, docker-compose*.yml/.yaml,
            compose*.yml/.yaml · 최대 {SCAN_UPLOAD_FILE_COUNT_LIMIT}개 · 총 {SCAN_UPLOAD_FILE_SIZE_LIMIT_MB}MB
          </p>
          {selectedFiles.length > 0 ? (
            <div className="border border-neutral-200 bg-[#f5f5f5] px-4 py-3 text-sm text-neutral-700">
              <div className="font-semibold text-black">선택된 파일</div>
              <ul className="mt-2 space-y-1">
                {selectedFiles.map((file) => (
                  <li className="font-mono" key={`${file.name}-${file.size}-${file.lastModified}`}>
                    {file.name} ({Math.ceil(file.size / 1024)} KB)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </label>
      ) : null}

      <label className="flex items-center gap-3 border border-neutral-200 bg-[#fafafa] px-4 py-3">
        <input
          checked={Boolean(value.includeLogs)}
          className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
          onChange={(event) => handleFieldChange('includeLogs', event.target.checked)}
          type="checkbox"
        />
        <span className="text-sm font-medium text-neutral-700">로그도 함께 점검합니다.</span>
      </label>

      {errorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <button
        className="inline-flex bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
        disabled={isSubmitting}
        onClick={onSubmit}
        type="button"
      >
        {isSubmitting ? '요청 중...' : scanRequestMethod === 'UPLOAD' ? '업로드 후 스캔 요청' : '스캔 요청 시작'}
      </button>
    </div>
  );
}

export default ScanRequestForm;
