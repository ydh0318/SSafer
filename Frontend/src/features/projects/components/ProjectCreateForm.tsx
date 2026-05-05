import { AlertCircle, LoaderCircle, Upload } from 'lucide-react';

import type { CreateProjectFormValues, ScanMode } from '../../../types/project';

type ProjectCreateFormProps = {
  value: CreateProjectFormValues;
  selectedUploadFile: File | null;
  onChange: (next: CreateProjectFormValues) => void;
  onUploadFileChange: (file: File | null) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  title?: string;
  description?: string;
  submitLabel?: string;
};

const scanModeOptions: Array<{ value: ScanMode; label: string; helper: string }> = [
  {
    value: 'AGENT',
    label: '로컬 에이전트 스캔',
    helper: '프로젝트 생성 후 로컬 에이전트가 직접 경로를 검사하는 기본 흐름입니다.',
  },
  {
    value: 'UPLOAD',
    label: '파일 업로드 스캔',
    helper: '프로젝트 생성 후 JSON 결과 파일을 업로드해 스캔을 바로 등록할 수 있습니다.',
  },
];

function ProjectCreateForm({
  value,
  selectedUploadFile,
  onChange,
  onUploadFileChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errorMessage,
  title = '새 프로젝트 만들기',
  description = '프로젝트를 만들면서 필요하면 첫 스캔 결과 파일도 함께 업로드할 수 있습니다.',
  submitLabel = '프로젝트 생성',
}: ProjectCreateFormProps) {
  const setField = <K extends keyof CreateProjectFormValues>(
    field: K,
    nextValue: CreateProjectFormValues[K],
  ) => {
    onChange({
      ...value,
      [field]: nextValue,
    });
  };

  const isNameBlank = value.name.trim().length === 0;

  return (
    <div className="rounded-[1.75rem] border border-[#e9e2d4] bg-[#fffdfa] p-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-black text-[#111111]">{title}</h3>
        <p className="text-sm leading-6 text-[#6b6257]">{description}</p>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-bold text-[#3d352d]">프로젝트 이름</span>
          <input
            className="rounded-2xl border border-[#ded8cc] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
            maxLength={255}
            onChange={(event) => setField('name', event.target.value)}
            placeholder="예: payment-api"
            value={value.name}
          />
          <span className="text-xs text-[#8b7f6a]">이 이름을 기준으로 프로젝트와 스캔 이력이 연결됩니다.</span>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold text-[#3d352d]">설명</span>
          <textarea
            className="min-h-28 rounded-2xl border border-[#ded8cc] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
            maxLength={1000}
            onChange={(event) => setField('description', event.target.value)}
            placeholder="프로젝트 성격, 주요 점검 대상, 운영 환경 등을 적어두면 이후 관리에 도움이 됩니다."
            value={value.description}
          />
        </label>

        <div className="grid gap-3">
          <span className="text-sm font-bold text-[#3d352d]">기본 스캔 방식</span>
          <div className="grid gap-3 md:grid-cols-2">
            {scanModeOptions.map((option) => (
              <button
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  value.defaultScanMode === option.value
                    ? 'border-[#111111] bg-[#111111] text-white'
                    : 'border-[#ded8cc] bg-white text-[#111111] hover:border-[#111111]'
                }`}
                key={option.value}
                onClick={() => setField('defaultScanMode', option.value)}
                type="button"
              >
                <p className="text-sm font-black">{option.label}</p>
                <p className={`mt-2 text-xs leading-6 ${value.defaultScanMode === option.value ? 'text-slate-200' : 'text-[#6b6257]'}`}>
                  {option.helper}
                </p>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-[#ded8cc] bg-[#faf7f0] px-4 py-3">
          <input
            checked={value.monitorEnabled}
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            onChange={(event) => setField('monitorEnabled', event.target.checked)}
            type="checkbox"
          />
          <span className="text-sm font-medium text-[#4b4339]">모니터링 기능을 활성화합니다.</span>
        </label>

        <section className="rounded-[1.5rem] border border-dashed border-[#d8cfbd] bg-[#faf7f0] p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white p-3 text-slate-900 shadow-sm">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-[#111111]">프로젝트 생성과 동시에 첫 스캔 업로드</p>
              <p className="mt-2 text-sm leading-6 text-[#6b6257]">
                선택 사항입니다. JSON 스캔 결과 파일을 고르면 프로젝트를 만든 직후 첫 업로드 스캔까지 자동으로 등록합니다.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#3d352d]">초기 스캔 결과 파일</span>
              <input
                accept=".json,application/json,text/json"
                className="w-full rounded-2xl border border-dashed border-[#cfc5b2] bg-white px-4 py-4 text-sm text-[#111111] outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-[#111111] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:border-[#8b7f6a]"
                onChange={(event) => onUploadFileChange(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>

            <p className="text-xs leading-6 text-[#8b7f6a]">
              파일을 선택하지 않으면 프로젝트만 생성됩니다. 파일을 선택하면 프로젝트 생성 후 업로드 스캔이 자동으로 이어집니다.
            </p>

            {selectedUploadFile ? (
              <div className="rounded-2xl border border-[#ded8cc] bg-white px-4 py-3 text-sm text-[#4b4339]">
                선택된 파일: <strong>{selectedUploadFile.name}</strong> ({Math.ceil(selectedUploadFile.size / 1024)} KB)
              </div>
            ) : null}
          </div>
        </section>

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#262626] disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting || isNameBlank}
          onClick={onSubmit}
          type="button"
        >
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? '생성 중입니다...' : submitLabel}
        </button>
        <button
          className="inline-flex rounded-full border border-[#d7cfbf] px-5 py-3 text-sm font-bold text-[#3d352d] transition hover:border-[#8b7f6a]"
          onClick={onCancel}
          type="button"
        >
          취소
        </button>
      </div>
    </div>
  );
}

export default ProjectCreateForm;
