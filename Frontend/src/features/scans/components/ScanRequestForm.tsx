import { Terminal, Upload } from 'lucide-react';

import type { CreateScanRequestPayload } from '../../../types/scan';

export type ScanRequestMethod = 'AGENT' | 'UPLOAD';

type ScanRequestFormProps = {
  value: CreateScanRequestPayload;
  scanRequestMethod: ScanRequestMethod;
  selectedFile: File | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onChange: (nextValue: CreateScanRequestPayload) => void;
  onMethodChange: (nextValue: ScanRequestMethod) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
};

function ScanRequestForm({
  value,
  scanRequestMethod,
  selectedFile,
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
          }`}
          onClick={() => onMethodChange('AGENT')}
          type="button"
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <p className="text-sm font-black">로컬 에이전트 스캔</p>
          </div>
          <p className={`mt-2 text-xs leading-6 ${scanRequestMethod === 'AGENT' ? 'text-neutral-300' : 'text-neutral-500'}`}>
            연결된 로컬 에이전트가 프로젝트 경로를 기준으로 스캔을 수행합니다.
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
            <p className="text-sm font-black">파일 업로드 스캔</p>
          </div>
          <p className={`mt-2 text-xs leading-6 ${scanRequestMethod === 'UPLOAD' ? 'text-neutral-300' : 'text-neutral-500'}`}>
            스캔 결과 JSON 파일을 업로드해서 서버 분석 흐름을 바로 시작합니다.
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
          <span className="text-sm font-semibold text-black">요청 출처</span>
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
            placeholder="예: 운영 점검, 배포 전 검토"
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
          <span className="text-sm font-semibold text-black">스캔 결과 JSON 파일</span>
          <input
            accept=".json,application/json,text/json"
            className="w-full border border-dashed border-neutral-300 bg-[#fafafa] px-4 py-4 text-sm text-black outline-none transition file:mr-4 file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:border-black"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            type="file"
          />
          <p className="text-xs leading-6 text-neutral-500">
            업로드 파일은 presigned URL로 전송된 뒤 업로드 완료 보고 API까지 자동으로 이어집니다.
          </p>
          {selectedFile ? (
            <div className="border border-neutral-200 bg-[#f5f5f5] px-4 py-3 text-sm text-neutral-700">
              선택된 파일: <strong>{selectedFile.name}</strong> ({Math.ceil(selectedFile.size / 1024)} KB)
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
        <span className="text-sm font-medium text-neutral-700">로그 수집을 함께 요청합니다.</span>
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
        {isSubmitting ? '요청 중...' : scanRequestMethod === 'UPLOAD' ? '업로드 스캔 시작' : '스캔 요청 등록'}
      </button>
    </div>
  );
}

export default ScanRequestForm;
