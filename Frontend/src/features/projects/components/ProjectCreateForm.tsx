import { AlertCircle, LoaderCircle } from 'lucide-react';

import type { CreateProjectFormValues, ScanMode } from '../../../types/project';

type ProjectCreateFormProps = {
  value: CreateProjectFormValues;
  onChange: (next: CreateProjectFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  title?: string;
  description?: string;
  submitLabel?: string;
};

const scanModeOptions: Array<{ value: ScanMode; label: string; helper: string }> = [
  { value: 'AGENT', label: 'AGENT', helper: '에이전트 기반 분석을 기본값으로 사용합니다.' },
  { value: 'UPLOAD', label: 'UPLOAD', helper: '업로드 기반 분석을 기본값으로 사용합니다.' },
];

function ProjectCreateForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errorMessage,
  title = '새 프로젝트 생성',
  description = '프로젝트 API 스펙에 맞춰 입력값을 정리한 뒤 저장합니다.',
  submitLabel = '프로젝트 생성',
}: ProjectCreateFormProps) {
  const setField = <K extends keyof CreateProjectFormValues>(field: K, nextValue: CreateProjectFormValues[K]) => {
    onChange({
      ...value,
      [field]: nextValue,
    });
  };

  const isNameBlank = value.name.trim().length === 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-700">프로젝트명</span>
          <input
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            maxLength={255}
            onChange={(event) => setField('name', event.target.value)}
            placeholder="운영 서버 점검"
            value={value.name}
          />
          <span className="text-xs text-slate-500">trim 후 빈 문자열이면 전송하지 않도록 막습니다.</span>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-700">프로젝트 설명</span>
          <textarea
            className="min-h-28 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            maxLength={1000}
            onChange={(event) => setField('description', event.target.value)}
            placeholder="1차 보안 점검 프로젝트"
            value={value.description}
          />
          <span className="text-xs text-slate-500">빈 값은 null로 정규화해 전송합니다.</span>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          {scanModeOptions.map((option) => (
            <button
              className={`rounded-lg border px-4 py-4 text-left transition ${
                value.defaultScanMode === option.value
                  ? 'border-slate-950 bg-white text-slate-950'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
              }`}
              key={option.value}
              onClick={() => setField('defaultScanMode', option.value)}
              type="button"
            >
              <div className="text-sm font-black">{option.label}</div>
              <div className="mt-1 text-xs leading-5">{option.helper}</div>
            </button>
          ))}
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <input
            checked={value.monitorEnabled}
            className="h-4 w-4"
            onChange={(event) => setField('monitorEnabled', event.target.checked)}
            type="checkbox"
          />
          <div>
            <p className="text-sm font-bold text-slate-700">모니터링 사용</p>
            <p className="text-xs text-slate-500">미선택 시 false로 전송합니다.</p>
          </div>
        </label>
      </div>

      {errorMessage ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button
          className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-400"
          onClick={onCancel}
          type="button"
        >
          취소
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting || isNameBlank}
          onClick={onSubmit}
          type="button"
        >
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

export default ProjectCreateForm;
