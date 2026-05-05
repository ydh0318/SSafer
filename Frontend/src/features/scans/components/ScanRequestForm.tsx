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
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <button
          className={`rounded-2xl border px-4 py-4 text-left transition ${
            scanRequestMethod === 'AGENT'
              ? 'border-slate-950 bg-slate-950 text-white'
              : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'
          }`}
          onClick={() => onMethodChange('AGENT')}
          type="button"
        >
          <p className="text-sm font-black">로컬 에이전트 스캔</p>
          <p className={`mt-2 text-xs leading-6 ${scanRequestMethod === 'AGENT' ? 'text-slate-200' : 'text-slate-500'}`}>
            연결된 로컬 에이전트가 프로젝트 경로를 직접 검사하도록 요청합니다.
          </p>
        </button>
        <button
          className={`rounded-2xl border px-4 py-4 text-left transition ${
            scanRequestMethod === 'UPLOAD'
              ? 'border-slate-950 bg-slate-950 text-white'
              : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'
          }`}
          onClick={() => onMethodChange('UPLOAD')}
          type="button"
        >
          <p className="text-sm font-black">스캔 결과 파일 업로드</p>
          <p className={`mt-2 text-xs leading-6 ${scanRequestMethod === 'UPLOAD' ? 'text-slate-200' : 'text-slate-500'}`}>
            이미 생성된 JSON 결과 파일을 업로드해 서버에 스캔 이력을 등록합니다.
          </p>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-900">프로젝트 이름</span>
          <input
            className="w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-600 outline-none"
            readOnly
            type="text"
            value={value.projectName}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-900">요청 출처</span>
          <select
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            onChange={(event) => handleFieldChange('source', event.target.value as CreateScanRequestPayload['source'])}
            value={value.source ?? 'CLI'}
          >
            <option value="CLI">CLI</option>
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-900">스캔 이름</span>
          <input
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            onChange={(event) => handleFieldChange('scanName', event.target.value)}
            placeholder="예: 운영 서버 보안 점검"
            type="text"
            value={value.scanName ?? ''}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-900">대상 경로</span>
          <input
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            onChange={(event) => handleFieldChange('targetPath', event.target.value)}
            placeholder="/opt/app"
            type="text"
            value={value.targetPath ?? ''}
          />
        </label>
      </div>

      {scanRequestMethod === 'UPLOAD' ? (
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-900">스캔 결과 파일</span>
          <input
            accept=".json,application/json,text/json"
            className="w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-900 outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:border-slate-500"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            type="file"
          />
          <p className="text-xs leading-6 text-slate-500">
            JSON 파일을 업로드하면 presigned URL로 먼저 전송한 뒤 업로드 완료 API까지 자동으로 호출합니다.
          </p>
          {selectedFile ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              선택한 파일: <strong>{selectedFile.name}</strong> ({Math.ceil(selectedFile.size / 1024)} KB)
            </div>
          ) : null}
        </label>
      ) : null}

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <input
          checked={Boolean(value.includeLogs)}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
          onChange={(event) => handleFieldChange('includeLogs', event.target.checked)}
          type="checkbox"
        />
        <span className="text-sm font-medium text-slate-700">로그 수집을 포함합니다.</span>
      </label>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <button
        className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isSubmitting}
        onClick={onSubmit}
        type="button"
      >
        {isSubmitting ? '처리 중입니다...' : scanRequestMethod === 'UPLOAD' ? '파일 업로드 후 스캔 등록' : '스캔 요청 등록'}
      </button>
    </div>
  );
}

export default ScanRequestForm;
