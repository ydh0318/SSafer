import { AlertCircle, LoaderCircle, Upload } from 'lucide-react';

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
    helper: '프로젝트에 연결된 Local Agent를 통해 서버나 실행 환경 기준으로 분석을 시작합니다.',
  },
  {
    value: 'UPLOAD',
    label: '파일 업로드 스캔',
    helper: '.env, Dockerfile, docker-compose.yml 같은 파일을 올려 바로 분석할 수 있습니다.',
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
    onChange({
      ...value,
      [field]: nextValue,
    });
  };

  const isNameBlank = value.name.trim().length === 0;

  return (
    <div className="border border-neutral-200 bg-[#f8f8f8] p-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">NEW PROJECT</p>
        <h3 className="mt-3 text-3xl font-black tracking-tight text-black">{title}</h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-600">{description}</p>
      </div>

      <div className="mt-8 grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-bold text-black">프로젝트 이름</span>
          <input
            className="border border-neutral-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black"
            maxLength={255}
            onChange={(event) => setField('name', event.target.value)}
            placeholder="예: payment-api"
            value={value.name}
          />
          <span className="text-xs leading-6 text-neutral-500">프로젝트 목록과 스캔 결과에서 함께 표시되는 이름입니다.</span>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold text-black">프로젝트 설명</span>
          <textarea
            className="min-h-28 border border-neutral-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black"
            maxLength={1000}
            onChange={(event) => setField('description', event.target.value)}
            placeholder="이 프로젝트가 어떤 서비스인지, 어떤 설정 파일을 점검하려는지 간단히 적어 주세요."
            value={value.description}
          />
        </label>

        <div className="grid gap-3">
          <span className="text-sm font-bold text-black">기본 스캔 방식</span>
          <div className="grid gap-3 md:grid-cols-2">
            {scanModeOptions.map((option) => (
              <button
                className={`border px-4 py-4 text-left transition ${
                  value.defaultScanMode === option.value
                    ? 'border-black bg-black text-white'
                    : 'border-neutral-300 bg-white text-black hover:border-black'
                }`}
                key={option.value}
                onClick={() => setField('defaultScanMode', option.value)}
                type="button"
              >
                <p className="text-sm font-black">{option.label}</p>
                <p
                  className={`mt-2 text-xs leading-6 ${
                    value.defaultScanMode === option.value ? 'text-neutral-300' : 'text-neutral-500'
                  }`}
                >
                  {option.helper}
                </p>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 border border-neutral-200 bg-white px-4 py-3">
          <input
            checked={value.monitorEnabled}
            className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
            onChange={(event) => setField('monitorEnabled', event.target.checked)}
            type="checkbox"
          />
          <span className="text-sm font-medium text-neutral-700">이 프로젝트에서 모니터링과 Agent 상태 표시를 함께 사용합니다.</span>
        </label>

        <section className="border border-dashed border-neutral-300 bg-white p-5">
          <div className="flex items-start gap-4">
            <div className="bg-black p-3 text-white">
              <Upload className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-black">프로젝트 생성 후 바로 파일 업로드 스캔 시작</p>
              <p className="mt-2 text-sm leading-7 text-neutral-600">
                원하면 프로젝트를 만든 직후 바로 설정 파일을 업로드해 첫 스캔까지 이어서 진행할 수 있습니다. 지원 파일은 `.env`,
                `.env.local`, `.env.*`, `Dockerfile`, `Containerfile`, `docker-compose*.yml/.yaml`, `compose*.yml/.yaml`입니다.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-black">스캔할 파일</span>
              <input
                className="w-full border border-dashed border-neutral-300 bg-[#fafafa] px-4 py-4 text-sm text-black outline-none transition file:mr-4 file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:border-black"
                multiple
                onChange={(event) => onUploadFilesChange(Array.from(event.target.files ?? []))}
                type="file"
              />
            </label>
            <p className="text-xs leading-6 text-neutral-500">
              지원 파일: .env, .env.local, .env.*, Dockerfile, Containerfile, docker-compose*.yml/.yaml, compose*.yml/.yaml
            </p>
            {selectedUploadFiles.length > 0 ? (
              <div className="border border-neutral-200 bg-[#f5f5f5] px-4 py-3 text-sm text-neutral-700">
                <div className="font-semibold text-black">선택한 파일</div>
                <ul className="mt-2 space-y-1">
                  {selectedUploadFiles.map((file) => (
                    <li className="font-mono" key={`${file.name}-${file.size}-${file.lastModified}`}>
                      {file.name} ({Math.ceil(file.size / 1024)} KB)
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {errorMessage ? (
          <div className="flex items-start gap-3 border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          className="inline-flex items-center gap-2 bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
          disabled={isSubmitting || isNameBlank}
          onClick={onSubmit}
          type="button"
        >
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? '생성 중...' : submitLabel}
        </button>
        <button
          className="border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
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
