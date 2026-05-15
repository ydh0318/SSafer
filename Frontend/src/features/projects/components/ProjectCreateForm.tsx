import { AlertCircle, LoaderCircle, Upload, X } from 'lucide-react';

import type { CreateProjectFormValues, ScanMode } from '../../../types/project';

type ProjectCreateFormProps = {
  value: CreateProjectFormValues;
  selectedUploadFiles: File[];
  onChange: (next: CreateProjectFormValues) => void;
  onUploadFilesChange: (files: File[]) => void;
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
    label: '로컬 Agent 스캔',
    helper: '연결된 Agent를 통해 서버나 실행 환경 기준으로 분석합니다.',
  },
  {
    value: 'UPLOAD',
    label: '파일 업로드 스캔',
    helper: '.env, Dockerfile, docker-compose.yml 파일을 올려 바로 분석합니다.',
  },
];

function ProjectCreateForm({
  value,
  selectedUploadFiles,
  onChange,
  onUploadFilesChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errorMessage,
  title = '새 프로젝트 만들기',
  description = '프로젝트 정보를 먼저 등록한 뒤, 필요하면 바로 파일을 업로드해 첫 스캔까지 이어서 시작할 수 있습니다.',
  submitLabel = '프로젝트 생성',
}: ProjectCreateFormProps) {
  const setField = <K extends keyof CreateProjectFormValues>(field: K, nextValue: CreateProjectFormValues[K]) => {
    onChange({ ...value, [field]: nextValue });
  };

  const isNameBlank = value.name.trim().length === 0;

  return (
    <div className="w-full bg-white">
      {/* 헤더 */}
      <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
        <div>
          <p className="font-mono text-[10px] font-bold tracking-[0.28em] text-neutral-400 uppercase">NEW PROJECT</p>
          <h3 className="mt-1.5 text-xl font-black tracking-tight text-black">{title}</h3>
          <p className="mt-1 text-sm text-neutral-500 leading-relaxed">{description}</p>
        </div>
      </div>

      {/* 2열 레이아웃 */}
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-100">

        {/* 왼쪽: 기본 정보 */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-[11px] font-bold tracking-[0.18em] text-neutral-400 uppercase">기본 정보</p>

          {/* 프로젝트 이름 */}
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-black" htmlFor="project-name">
              이름 <span className="text-rose-400">*</span>
            </label>
            <input
              id="project-name"
              autoFocus
              className="w-full border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-black outline-none transition placeholder:text-neutral-400 focus:border-black focus:bg-white"
              maxLength={255}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="예: payment-api"
              value={value.name}
            />
          </div>

          {/* 프로젝트 설명 */}
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-black" htmlFor="project-desc">
              설명
            </label>
            <textarea
              id="project-desc"
              className="w-full border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-black outline-none transition placeholder:text-neutral-400 focus:border-black focus:bg-white min-h-[88px] resize-none"
              maxLength={1000}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="어떤 서비스인지, 어떤 파일을 점검하려는지 간단히 적어 주세요."
              value={value.description}
            />
          </div>

          {/* 모니터링 */}
          <label className="flex items-center gap-2.5 cursor-pointer py-2">
            <input
              checked={value.monitorEnabled}
              className="h-4 w-4 border-neutral-300 accent-black"
              onChange={(e) => setField('monitorEnabled', e.target.checked)}
              type="checkbox"
            />
            <span className="text-sm text-neutral-700">모니터링 및 Agent 상태 표시 사용</span>
          </label>
        </div>

        {/* 오른쪽: 스캔 설정 + 파일 */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-[11px] font-bold tracking-[0.18em] text-neutral-400 uppercase">스캔 설정</p>

          {/* 기본 스캔 방식 */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-black">기본 스캔 방식</p>
            <div className="grid gap-2">
              {scanModeOptions.map((option) => {
                const isSelected = value.defaultScanMode === option.value;
                return (
                  <button
                    key={option.value}
                    className={`border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-black bg-black text-white'
                        : 'border-neutral-200 bg-neutral-50 text-black hover:border-neutral-400'
                    }`}
                    onClick={() => setField('defaultScanMode', option.value)}
                    type="button"
                  >
                    <p className="text-sm font-bold">{option.label}</p>
                    <p className={`mt-0.5 text-xs leading-relaxed ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>
                      {option.helper}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 파일 업로드 (선택) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-black">첫 스캔 파일</p>
              <span className="text-xs text-neutral-400">선택</span>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">
              생성 직후 바로 스캔을 시작합니다. .env, Dockerfile, docker-compose*.yml 등을 올려 주세요.
            </p>
            <label className="flex cursor-pointer items-center gap-2 border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600 transition hover:border-black hover:text-black">
              <Upload className="h-4 w-4 shrink-0" />
              파일 선택
              <input
                className="sr-only"
                multiple
                onChange={(e) => onUploadFilesChange(Array.from(e.target.files ?? []))}
                type="file"
              />
            </label>

            {selectedUploadFiles.length > 0 && (
              <div className="space-y-1">
                {selectedUploadFiles.map((file) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center justify-between border border-neutral-200 bg-white px-3 py-1.5"
                  >
                    <span className="font-mono text-xs text-neutral-700 truncate">{file.name}</span>
                    <span className="ml-3 shrink-0 text-[11px] text-neutral-400">{Math.ceil(file.size / 1024)} KB</span>
                  </div>
                ))}
                <button
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-rose-500 transition"
                  onClick={() => onUploadFilesChange([])}
                  type="button"
                >
                  <X className="h-3 w-3" />
                  모두 지우기
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 에러 */}
      {errorMessage && (
        <div className="mx-6 mb-2 flex items-start gap-3 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 푸터 */}
      <div className="flex items-center justify-between border-t border-neutral-100 px-6 py-4">
        <button
          className="text-sm text-neutral-500 hover:text-black transition"
          onClick={onCancel}
          type="button"
        >
          취소
        </button>
        <button
          className="inline-flex items-center gap-2 bg-neutral-300 px-5 py-2.5 text-sm font-bold text-neutral-500 transition disabled:cursor-not-allowed disabled:opacity-40 enabled:bg-[#D4FC64] enabled:text-black enabled:hover:brightness-95"
          disabled={isSubmitting || isNameBlank}
          onClick={onSubmit}
          type="button"
        >
          {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {isSubmitting ? '생성 중...' : submitLabel}
        </button>
      </div>
    </div>
  );
}

export default ProjectCreateForm;
