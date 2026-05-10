import { Check, Circle, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { ScanProgressStatusData } from '../../../types/scan';
import { formatDateTime, isTerminalScanStatus } from '../utils/scanPresentation';

type ScanProgressPanelProps = {
  statusData: ScanProgressStatusData | null;
  isLoading: boolean;
  errorMessage: string | null;
  isAutoRefreshEnabled: boolean;
  onRefresh: () => void;
  onAutoRefreshChange: (nextValue: boolean) => void;
};

const progressSteps = [
  { key: 'SCAN_REGISTERED', statusKey: 'REQUESTED', code: 'SCAN_REGISTERED', label: '스캔 요청 등록' },
  { key: 'AGENT_DISPATCHED', statusKey: 'QUEUED', code: 'AGENT_DISPATCHED', label: '작업 대기열 등록' },
  { key: 'SCAN_RUNNING', statusKey: 'RUNNING', code: 'SCAN_RUNNING', label: '보안 점검 실행' },
  { key: 'RAW_UPLOADED', statusKey: 'RAW_UPLOADED', code: 'RAW_UPLOADED', label: '원본 결과 업로드' },
  { key: 'ANALYSIS_RUNNING', statusKey: 'RAW_UPLOADED', code: 'ANALYSIS_RUNNING', label: 'AI 분석 진행' },
  { key: 'DONE', statusKey: 'DONE', code: 'DONE', label: '결과 생성 완료' },
] as const;

const typingTips = [
  'USER node',
  'ports:\n  - "127.0.0.1:5432:5432"',
  'PermitRootLogin no',
  'DB_PASSWORD=${DB_PASSWORD}',
] as const;

function resolveActiveStepIndex(statusData: ScanProgressStatusData | null) {
  if (!statusData) {
    return 0;
  }

  if (statusData.status === 'DONE') {
    return progressSteps.length - 1;
  }

  if (statusData.status === 'FAILED' || statusData.status === 'CANCELED') {
    return Math.max(progressSteps.findIndex((step) => step.statusKey === 'RAW_UPLOADED'), 0);
  }

  const progressStep = statusData.progressStep?.trim();

  if (progressStep) {
    const progressStepIndex = progressSteps.findIndex((step) => step.key === progressStep || step.code === progressStep);

    if (progressStepIndex >= 0) {
      return progressStepIndex;
    }
  }

  return Math.max(
    progressSteps.findIndex((step) => step.statusKey === statusData.status),
    0,
  );
}

function getHeadline(statusData: ScanProgressStatusData | null, activeStepLabel: string) {
  if (!statusData) {
    return '스캔 상태를 확인하는 중입니다.';
  }

  if (statusData.status === 'DONE') {
    return '분석이 완료되었습니다.';
  }

  if (statusData.status === 'FAILED') {
    return '분석이 중단되었습니다.';
  }

  if (statusData.status === 'CANCELED') {
    return '스캔이 취소되었습니다.';
  }

  return activeStepLabel;
}

function getGuideMessage(statusData: ScanProgressStatusData | null) {
  if (!statusData) {
    return '잠시만 기다려 주세요. 스캔 상태를 불러오고 있습니다.';
  }

  if (statusData.status === 'DONE') {
    return '결과 화면으로 이동해 탐지된 항목과 수정 가이드를 확인해 보세요.';
  }

  if (statusData.status === 'FAILED') {
    return statusData.errorMessage || '분석 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (statusData.status === 'CANCELED') {
    return '스캔이 취소되었습니다. 다시 요청하면 처음부터 분석을 시작합니다.';
  }

  return '보통 10초에서 30초 정도 소요됩니다. 화면을 벗어나더라도 다시 돌아오면 상태를 이어서 확인할 수 있습니다.';
}

function ScanProgressPanel({
  statusData,
  isLoading,
  errorMessage,
  isAutoRefreshEnabled,
  onRefresh,
  onAutoRefreshChange,
}: ScanProgressPanelProps) {
  const activeStepIndex = resolveActiveStepIndex(statusData);
  const isTerminal = statusData ? isTerminalScanStatus(statusData.status) : false;
  const progressPercent = Math.min((activeStepIndex / (progressSteps.length - 1)) * 100, 100);
  const [tipIndex, setTipIndex] = useState(0);
  const [typedTip, setTypedTip] = useState('');

  useEffect(() => {
    let charIndex = 0;
    const currentTip = typingTips[tipIndex];
    setTypedTip('');

    const intervalId = window.setInterval(() => {
      charIndex += 1;
      setTypedTip(currentTip.slice(0, charIndex));

      if (charIndex >= currentTip.length) {
        window.clearInterval(intervalId);
        window.setTimeout(() => setTipIndex((current) => (current + 1) % typingTips.length), 1200);
      }
    }, 55);

    return () => window.clearInterval(intervalId);
  }, [tipIndex]);

  const activeStep = progressSteps[activeStepIndex];
  const headline = useMemo(() => getHeadline(statusData, activeStep.label), [activeStep.label, statusData]);
  const guideMessage = useMemo(() => getGuideMessage(statusData), [statusData]);

  if (isLoading) {
    return <div className="bg-white px-6 py-12 text-sm text-neutral-500">스캔 상태를 불러오는 중입니다.</div>;
  }

  if (errorMessage) {
    return <div className="border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">{errorMessage}</div>;
  }

  if (!statusData) {
    return <div className="bg-white px-6 py-12 text-sm text-neutral-500">확인할 수 있는 스캔 상태가 없습니다.</div>;
  }

  return (
    <section className="space-y-14">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] tracking-[0.24em] text-[#9FCC2E]">SCAN STATUS</span>
            <span className="font-mono text-xs text-neutral-400">scanId #{statusData.scanId}</span>
          </div>
          <h1 className="mt-8 text-6xl font-black leading-none tracking-[-0.05em] text-[#080B16] md:text-8xl">
            {Math.round(progressPercent)}
            <span className="ml-3 text-4xl text-neutral-400 md:text-5xl">%</span>
          </h1>
          <p className="mt-6 text-2xl font-black">{headline}</p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">{guideMessage}</p>
          <div className="mt-3 flex flex-wrap gap-4 font-mono text-xs text-neutral-400">
            <span>requestedAt {formatDateTime(statusData.requestedAt)}</span>
            {statusData.startedAt ? <span>startedAt {formatDateTime(statusData.startedAt)}</span> : null}
            {statusData.completedAt ? <span>completedAt {formatDateTime(statusData.completedAt)}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-neutral-500">
            <input
              checked={isAutoRefreshEnabled}
              className="h-4 w-4"
              onChange={(event) => onAutoRefreshChange(event.target.checked)}
              type="checkbox"
            />
            자동 새로고침
          </label>
          <button
            className="inline-flex items-center gap-2 border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-600 hover:border-black hover:text-black"
            onClick={onRefresh}
            type="button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            상태 새로고침
          </button>
        </div>
      </div>

      <div className="h-1 bg-neutral-200">
        <div className="h-full bg-[#111111] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="space-y-6 font-mono text-sm">
        {progressSteps.map((step, index) => {
          const isDone = index < activeStepIndex || (isTerminal && index <= activeStepIndex);
          const isActive = index === activeStepIndex && !isTerminal;

          return (
            <div
              className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-6 ${
                isDone ? 'text-neutral-400' : isActive ? 'text-black' : 'text-neutral-300'
              }`}
              key={step.key}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center">
                {isDone ? (
                  <Check className="h-4 w-4" />
                ) : isActive ? (
                  <span className="h-2 w-2 rounded-full bg-[#9FCC2E]" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </span>
              <span className={isActive ? 'font-black text-black' : ''}>{step.code}</span>
              <span className={isActive ? 'font-black text-black' : ''}>{step.label}</span>
            </div>
          );
        })}
      </div>

      <div className="bg-[#111111] p-8 text-white md:p-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="font-mono text-[11px] tracking-[0.24em] text-[#D4FC64]">SECURITY TIP</p>
            <h2 className="mt-4 text-2xl font-black">분석이 진행되는 동안 이런 설정도 확인해 보세요.</h2>
          </div>
          <span className="font-mono text-sm text-neutral-400">
            {tipIndex + 1} / {typingTips.length}
          </span>
        </div>

        <div className="mt-8 min-h-28 bg-neutral-950 p-6 font-mono text-base text-[#D4FC64]">
          <span className="whitespace-pre-wrap">{typedTip}</span>
          <span className="ml-1 inline-block h-5 w-2 translate-y-1 animate-pulse bg-[#D4FC64]" />
        </div>

        {statusData.errorMessage ? <p className="mt-5 text-sm text-rose-300">{statusData.errorMessage}</p> : null}
      </div>
    </section>
  );
}

export default ScanProgressPanel;
