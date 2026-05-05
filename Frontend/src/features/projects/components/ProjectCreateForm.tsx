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
  {
    value: 'AGENT',
    label: 'CLI / AGENT',
    helper: '로컬 CLI와 에이전트 기반 스캔을 기본 방식으로 사용하는 프로젝트에 적합합니다.',
  },
  {
    value: 'UPLOAD',
    label: 'UPLOAD',
    helper: '파일 업로드로 빠르게 점검을 반복하는 프로젝트에 적합합니다.',
  },
];

function ProjectCreateForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errorMessage,
  title = '새 프로젝트 만들기',
  description = '프로젝트를 등록해 스캔 이력과 분석 결과를 지속적으로 관리하세요.',
  submitLabel = '프로젝트 만들기',
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
          <span className="text-xs text-[#8b7f6a]">대시보드와 스캔 상세 화면에 표시됩니다.</span>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold text-[#3d352d]">설명</span>
          <textarea
            className="min-h-28 rounded-2xl border border-[#ded8cc] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
            maxLength={1000}
            onChange={(event) => setField('description', event.target.value)}
            placeholder="프로젝트의 배포 환경, 점검 대상, 팀 목적 등을 간단히 적어주세요."
            value={value.description}
          />
          <span className="text-xs text-[#8b7f6a]">입력하지 않으면 비워 둔 상태로 저장됩니다.</span>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          {scanModeOptions.map((option) => (
            <button
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                value.defaultScanMode === option.value
                  ? 'border-[#111111] bg-white text-[#111111]'
                  : 'border-[#e6dfd2] bg-white text-[#6b6257] hover:border-[#b5aa96]'
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

        <label className="flex items-center gap-3 rounded-2xl border border-[#e6dfd2] bg-white px-4 py-3">
          <input
            checked={value.monitorEnabled}
            className="h-4 w-4"
            onChange={(event) => setField('monitorEnabled', event.target.checked)}
            type="checkbox"
          />
          <div>
            <p className="text-sm font-bold text-[#3d352d]">모니터링 활성화</p>
            <p className="text-xs text-[#8b7f6a]">
              프로젝트 상태와 최근 스캔 진행 상황을 대시보드에서 더 쉽게 추적합니다.
            </p>
          </div>
        </label>
      </div>

      {errorMessage ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button
          className="rounded-full border border-[#d7d0c2] px-4 py-3 text-sm font-bold text-[#4c4338] transition hover:border-[#9f937f]"
          onClick={onCancel}
          type="button"
        >
          취소
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-black text-white transition hover:bg-[#262626] disabled:cursor-not-allowed disabled:bg-[#a7a19a]"
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
