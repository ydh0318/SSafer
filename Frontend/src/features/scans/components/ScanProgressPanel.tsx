import { Check, RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { ScanProgressStatusData, ScanType } from '../../../types/scan';
import { formatDateTime, isTerminalScanStatus } from '../utils/scanPresentation';

type ScanProgressPanelProps = {
  statusData: ScanProgressStatusData | null;
  isLoading: boolean;
  errorMessage: string | null;
  isAutoRefreshEnabled: boolean;
  onRefresh: () => void;
  onAutoRefreshChange: (nextValue: boolean) => void;
};

type ProgressStep = {
  key: string;
  statusKey: ScanProgressStatusData['status'];
  code: string;
  label: string;
  doing: string;
  checks: string[];
};

type SecurityTipPreviewProps = {
  code: string;
};

function getRunningStepChecks(scanType: ScanType | undefined): string[] {
  if (scanType === 'SERVER_AUDIT') {
    return [
      '노출된 포트와 접근 가능한 서비스를 점검합니다.',
      '접근 제어와 로그인 정책을 확인합니다.',
      '사용자 권한과 인증 설정을 점검합니다.',
      '패키지와 시스템 보안 상태를 살펴봅니다.',
    ];
  }

  return [
    '설정 파일에 하드코딩된 비밀값이 있는지 확인합니다.',
    'Dockerfile과 compose 보안 설정을 점검합니다.',
    '컨테이너 권한과 노출 설정을 확인합니다.',
    '베이스 이미지의 알려진 취약점을 스캔합니다.',
  ];
}

function getRunningStepDoing(scanType: ScanType | undefined): string {
  if (scanType === 'SERVER_AUDIT') {
    return 'Trivy와 커스텀 규칙으로 서버 환경을 스캔하고 있습니다.';
  }

  return 'Trivy와 커스텀 규칙으로 프로젝트 파일과 설정을 스캔하고 있습니다.';
}

function getProgressSteps(scanType: ScanType | undefined): ProgressStep[] {
  return [
    {
      key: 'SCAN_REGISTERED',
      statusKey: 'REQUESTED',
      code: 'SCAN_REGISTERED',
      label: '요청 접수',
      doing: '스캔 작업을 생성하고 요청 정보를 확인하고 있습니다.',
      checks: ['요청 값을 검증합니다.', '프로젝트 접근 권한을 확인합니다.', '작업 큐를 준비합니다.'],
    },
    {
      key: 'AGENT_DISPATCHED',
      statusKey: 'QUEUED',
      code: 'AGENT_DISPATCHED',
      label: '대기 중',
      doing: '엔진이 작업을 받아 실행 준비를 하고 있습니다.',
      checks: ['스캔 작업을 큐에 등록합니다.', '엔진 연결 상태를 확인합니다.', '스캔 범위를 정리합니다.'],
    },
    {
      key: 'SCAN_RUNNING',
      statusKey: 'RUNNING',
      code: 'SCAN_RUNNING',
      label: '스캔 중',
      doing: getRunningStepDoing(scanType),
      checks: getRunningStepChecks(scanType),
    },
    {
      key: 'RAW_UPLOADED',
      statusKey: 'RAW_UPLOADED',
      code: 'RAW_UPLOADED',
      label: '결과 저장',
      doing: '원본 스캔 데이터를 업로드하고 AI 분석 준비를 하고 있습니다.',
      checks: ['원본 결과를 업로드합니다.', 'AI 분석 작업을 대기열에 넣습니다.', '취약점 파싱을 준비합니다.'],
    },
    {
      key: 'ANALYSIS_RUNNING',
      statusKey: 'RAW_UPLOADED',
      code: 'ANALYSIS_RUNNING',
      label: 'AI 분석',
      doing: 'AI가 위험도, 영향도, 권장 조치사항을 정리하고 있습니다.',
      checks: [
        '심각도와 영향을 해석합니다.',
        '설명 문구를 작성합니다.',
        '패치 제안을 생성합니다.',
        '가이드와 참고 정보를 정리합니다.',
      ],
    },
    {
      key: 'DONE',
      statusKey: 'DONE',
      code: 'DONE',
      label: '완료',
      doing: '스캔과 분석이 모두 완료되었습니다.',
      checks: ['취약점을 저장합니다.', '조치 가이드를 마무리합니다.', '결과 화면을 준비합니다.'],
    },
  ];
}

const securityTips = [
  { label: '환경 변수를 분리하세요', code: 'DB_PASSWORD=${DB_PASSWORD}' },
  { label: '포트 바인딩을 최소화하세요', code: 'ports:\n  - "127.0.0.1:5432:5432"' },
  { label: 'SSH root 로그인을 비활성화하세요', code: 'PermitRootLogin no' },
  { label: '루트가 아닌 사용자로 실행하세요', code: 'USER node' },
] as const;

function resolveActiveStepIndex(
  statusData: ScanProgressStatusData | null,
  progressSteps: readonly ProgressStep[],
) {
  if (!statusData) return 0;
  if (statusData.status === 'DONE') return progressSteps.length - 1;
  if (statusData.status === 'FAILED' || statusData.status === 'CANCELED') {
    return Math.max(progressSteps.findIndex((step) => step.statusKey === 'RAW_UPLOADED'), 0);
  }

  const progressStep = statusData.progressStep?.trim();
  if (progressStep) {
    const matchedIndex = progressSteps.findIndex((step) => step.key === progressStep || step.code === progressStep);
    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  return Math.max(progressSteps.findIndex((step) => step.statusKey === statusData.status), 0);
}

function SecurityTipPreview({ code }: SecurityTipPreviewProps) {
  const [typedCode, setTypedCode] = useState('');

  useEffect(() => {
    let charIndex = 0;
    const intervalId = window.setInterval(() => {
      charIndex += 1;
      setTypedCode(code.slice(0, charIndex));

      if (charIndex >= code.length) {
        window.clearInterval(intervalId);
      }
    }, 50);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [code]);

  return (
    <>
      <span className="whitespace-pre-wrap">{typedCode}</span>
      <span className="ml-0.5 inline-block h-4 w-[6px] translate-y-0.5 animate-pulse bg-[#D4FC64]" />
    </>
  );
}

function ScanProgressPanel({
  statusData,
  isLoading,
  errorMessage,
  isAutoRefreshEnabled,
  onRefresh,
  onAutoRefreshChange,
}: ScanProgressPanelProps) {
  const progressSteps = useMemo(() => getProgressSteps(statusData?.scanType), [statusData?.scanType]);
  const activeStepIndex = resolveActiveStepIndex(statusData, progressSteps);
  const isTerminal = statusData ? isTerminalScanStatus(statusData.status) : false;
  const progressPercent = Math.min((activeStepIndex / (progressSteps.length - 1)) * 100, 100);
  const activeStep = progressSteps[activeStepIndex];
  const isFailed = Boolean(statusData && (statusData.status === 'FAILED' || statusData.status === 'CANCELED'));

  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const activeTip = securityTips[tipIndex];
    const timeoutId = window.setTimeout(() => {
      setTipIndex((current) => (current + 1) % securityTips.length);
    }, activeTip.code.length * 50 + 1600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [tipIndex]);

  if (isLoading) {
    return (
        <div className="flex items-center gap-3 bg-neutral-50 px-8 py-16 text-sm text-neutral-500">
          <span className="inline-block h-2 w-2 animate-ping rounded-full bg-[#9FCC2E]" />
        스캔 상태를 불러오는 중입니다...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex items-center gap-3 border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">
        <X className="h-4 w-4 shrink-0" />
        {errorMessage}
      </div>
    );
  }

  if (!statusData) {
    return <div className="bg-neutral-50 px-8 py-16 text-sm text-neutral-500">표시할 스캔 상태가 없습니다.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border border-neutral-100 bg-white px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">스캔 상태</span>
            <span className="font-mono text-[10px] text-neutral-300">#{statusData.scanId}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-500 transition hover:text-black">
              <input
                checked={isAutoRefreshEnabled}
                className="h-3.5 w-3.5 accent-black"
                onChange={(event) => onAutoRefreshChange(event.target.checked)}
                type="checkbox"
              />
              자동 새로고침
            </label>
            <button
              className="inline-flex items-center gap-1.5 border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 transition hover:border-black hover:text-black"
              onClick={onRefresh}
              type="button"
            >
              <RefreshCw className="h-3 w-3" />
              새로고침
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2 leading-none">
              <span className="text-7xl font-black tracking-tight text-black md:text-8xl">
                {isFailed ? (statusData.status === 'FAILED' ? '오류' : '중단') : Math.round(progressPercent)}
              </span>
              {!isFailed && <span className="text-4xl font-black text-neutral-300">%</span>}
            </div>
            <p className="mt-3 text-xl font-black text-black">{activeStep.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">
              {isFailed
                ? (statusData.errorMessage ?? '분석 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
                : activeStep.doing}
            </p>
          </div>

          <span className={`self-start rounded-full px-3 py-1 font-mono text-[11px] font-bold tracking-widest ${
            statusData.status === 'DONE'
              ? 'bg-[#D4FC64] text-black'
              : statusData.status === 'FAILED'
              ? 'bg-rose-100 text-rose-700'
              : statusData.status === 'CANCELED'
              ? 'bg-neutral-100 text-neutral-500'
              : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-[0_0_0_3px_rgba(37,99,235,0.08)] animate-pulse'
          }`}>
            {statusData.status}
          </span>
        </div>

        <div className="mt-8 h-1 rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-black transition-all duration-700" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="mt-4 flex">
          {progressSteps.map((step, index) => {
            const isDone = index < activeStepIndex || (isTerminal && index <= activeStepIndex);
            const isActive = index === activeStepIndex && !isTerminal;

            return (
              <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="relative flex h-8 w-8 items-center justify-center">
                  {isActive ? (
                    <>
                      <span className="absolute h-8 w-8 rounded-full bg-blue-500/25 animate-ping" />
                      <span className="absolute h-9 w-9 rounded-full border-2 border-blue-500/45 animate-pulse" />
                    </>
                  ) : null}
                  <div
                    className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      isDone
                        ? 'bg-black text-white'
                        : isActive
                        ? 'bg-blue-600 text-white shadow-[0_0_0_6px_rgba(37,99,235,0.16),0_0_28px_rgba(37,99,235,0.45)] ring-2 ring-white'
                        : 'bg-neutral-100 text-neutral-400'
                    }`}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : index + 1}
                  </div>
                </div>
                <span
                  className={`hidden text-center font-mono text-[9px] leading-tight sm:block ${
                    isActive ? 'font-bold text-black' : isDone ? 'text-neutral-400' : 'text-neutral-300'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-4 font-mono text-[11px] text-neutral-400">
          <span>요청 {formatDateTime(statusData.requestedAt)}</span>
          {statusData.startedAt && <span>시작 {formatDateTime(statusData.startedAt)}</span>}
          {statusData.completedAt && <span>완료 {formatDateTime(statusData.completedAt)}</span>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-neutral-100 bg-white px-6 py-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">현재 점검 항목</p>
          <p className="mt-3 text-sm font-black text-black">{activeStep.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{activeStep.doing}</p>

          <ul className="mt-4 space-y-2.5">
            {activeStep.checks.map((check, index) => (
              <li
                key={`${check}-${index}`}
                className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition ${
                  isTerminal ? 'text-neutral-600' : 'bg-blue-50 text-neutral-900 shadow-[inset_3px_0_0_#2563EB]'
                }`}
                style={!isTerminal ? { animationDelay: `${index * 120}ms` } : undefined}
              >
                <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
                  {!isTerminal ? <span className="absolute h-3 w-3 rounded-full bg-blue-500/40 animate-ping" /> : null}
                  <span className={`relative h-1.5 w-1.5 rounded-full ${isTerminal ? 'bg-[#9FCC2E]' : 'bg-blue-600'}`} />
                </span>
                {check}
              </li>
            ))}
          </ul>

          {!isTerminal && (
            <p className="mt-5 text-xs leading-relaxed text-neutral-400">
              대부분의 스캔은 10초에서 30초 안에 끝납니다. 이 페이지를 나가도 나중에 다시 돌아올 수 있습니다.
            </p>
          )}
        </div>

        <div className="border border-neutral-100 bg-white px-6 py-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">보안 인사이트</p>
            <span className="font-mono text-[10px] text-neutral-300">{tipIndex + 1} / {securityTips.length}</span>
          </div>
          <p className="mt-2 text-sm font-bold text-black">{securityTips[tipIndex].label}</p>

          <div className="mt-3 overflow-hidden rounded-lg bg-[#111]">
            <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0d0d0d] px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="select-none font-mono text-[10px] text-[#D4FC64]">{'>'}</span>
                <span className="font-mono text-[11px] tracking-[0.15em] text-neutral-500">yaml</span>
              </div>
              <span className="select-none font-mono text-[10px] tracking-wider text-neutral-700">secure-config.yml</span>
            </div>
            <div className="min-h-[80px] px-5 py-4 font-mono text-sm text-[#D4FC64]">
              <SecurityTipPreview code={securityTips[tipIndex].code} key={tipIndex} />
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-neutral-400">
            SSAfer는 스캔이 진행되는 동안 이런 설정 패턴도 함께 점검합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ScanProgressPanel;
