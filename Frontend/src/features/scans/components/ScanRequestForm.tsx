import { AlertCircle, Terminal, Upload } from 'lucide-react';

import type { CreateScanRequestPayload } from '../../../types/scan';
import { SCAN_UPLOAD_FILE_COUNT_LIMIT, SCAN_UPLOAD_FILE_SIZE_LIMIT_MB } from '../utils/uploadValidation';

export type ScanRequestMethod = 'AGENT' | 'UPLOAD';

type ScanRequestFormProps = {
  value: CreateScanRequestPayload;
  scanRequestMethod: ScanRequestMethod;
  agentAvailable?: boolean;
  agentStatus?: { status: string } | null;
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
  agentStatus = null,
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

  const isAgentMode = scanRequestMethod === 'AGENT';
  const agentOnline = agentStatus?.status === 'ONLINE';
  const isAgentSubmitBlocked = isAgentMode && !agentOnline;
  const agentBlockReason = isAgentMode && !agentStatus
    ? 'Agent가 연결되어 있지 않습니다.'
    : isAgentMode && !agentOnline
    ? 'Agent가 현재 오프라인 상태입니다. Agent를 실행한 후 다시 시도해 주세요.'
    : null;

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
            프로젝트에 연결된 Local Agent를 통해 서버 정보를 수집하고 점검을 이어서 진행할 수 있습니다.
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
            설정 파일을 업로드해 바로 스캔을 시작하고, 결과를 화면에서 확인할 수 있습니다.
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

        {/* 실행 방식: UPLOAD 모드에서만 노출 (AGENT는 source 불필요) */}
        {!isAgentMode && (
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-black">실행 방식</span>
            <select
              className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black"
              onChange={(event) => handleFieldChange('source', event.target.value as CreateScanRequestPayload['source'])}
              value={value.source ?? 'CLI'}
            >
              <option value="CLI">CLI</option>
            </select>
          </label>
        )}

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-black">스캔 이름</span>
          <input
            className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black"
            onChange={(event) => handleFieldChange('scanName', event.target.value)}
            placeholder="예: 운영 서버 점검 스캔"
            type="text"
            value={value.scanName ?? ''}
          />
        </label>

        {/* 대상 경로: AGENT 모드에서만 노출 */}
        {isAgentMode && (
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-black">
              대상 경로 <span className="text-rose-500">*</span>
            </span>
            <input
              className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black"
              onChange={(event) => handleFieldChange('targetPath', event.target.value)}
              placeholder="/opt/app"
              type="text"
              value={value.targetPath ?? ''}
            />
            <p className="text-xs text-neutral-500">Agent가 점검할 서버의 절대 경로를 입력하세요.</p>
          </label>
        )}
      </div>

      {scanRequestMethod === 'UPLOAD' ? (
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-black">업로드 파일</span>
          <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-bold">업로드 전 확인</div>
            <ul className="mt-2 space-y-1 text-xs leading-6 text-amber-800">
              <li>파일은 최대 {SCAN_UPLOAD_FILE_COUNT_LIMIT}개까지 업로드할 수 있습니다.</li>
              <li>전체 파일 용량 합계는 {SCAN_UPLOAD_FILE_SIZE_LIMIT_MB}MB 이하여야 합니다.</li>
              <li>허용 형식: `.env`, `.env.*`, `Dockerfile`, `Containerfile`, `docker-compose*.yml/.yaml`, `compose*.yml/.yaml`</li>
            </ul>
          </div>
          <input
            className="w-full border border-dashed border-neutral-300 bg-[#fafafa] px-4 py-4 text-sm text-black outline-none transition file:mr-4 file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:border-black"
            multiple
            onChange={(event) => onFileChange(Array.from(event.target.files ?? []))}
            type="file"
          />
          <p className="text-xs leading-6 text-neutral-500">
            파일 제한은 선택 직후 바로 검증되며, 조건을 넘으면 스캔 요청 전에 안내됩니다.
          </p>
          {selectedFiles.length > 0 ? (
            <div className="border border-neutral-200 bg-[#f5f5f5] px-4 py-3 text-sm text-neutral-700">
              <div className="font-semibold text-black">선택한 파일</div>
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
        <span className="text-sm font-medium text-neutral-700">로그 정보를 함께 점검합니다.</span>
      </label>

      {agentBlockReason && (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{agentBlockReason}</span>
        </div>
      )}

      {errorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <button
        className="inline-flex bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
        disabled={isSubmitting || isAgentSubmitBlocked}
        onClick={onSubmit}
        title={agentBlockReason ?? undefined}
        type="button"
      >
        {isSubmitting ? '요청 중...' : isAgentMode ? 'Agent 점검 시작' : '업로드 후 스캔 요청'}
      </button>
    </div>
  );
}

export default ScanRequestForm;
