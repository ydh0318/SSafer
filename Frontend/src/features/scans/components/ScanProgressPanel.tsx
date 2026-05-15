import { Check, RefreshCw, X } from 'lucide-react';
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
  {
    key: 'SCAN_REGISTERED',
    statusKey: 'REQUESTED',
    code: 'SCAN_REGISTERED',
    label: '요청 등록',
    doing: '스캔 작업을 시스템에 등록하고 있습니다.',
    checks: ['스캔 요청 유효성 검사', '프로젝트 권한 확인', '작업 큐 배치 준비'],
  },
  {
    key: 'AGENT_DISPATCHED',
    statusKey: 'QUEUED',
    code: 'AGENT_DISPATCHED',
    label: '대기열 등록',
    doing: '엔진 서버에 작업을 배포하고 응답을 기다립니다.',
    checks: ['RabbitMQ 작업 큐 등록', '엔진 서버 연결 확인', '스캔 범위 설정'],
  },
  {
    key: 'SCAN_RUNNING',
    statusKey: 'RUNNING',
    code: 'SCAN_RUNNING',
    label: '보안 점검',
    doing: 'Trivy와 커스텀 룰로 설정 파일을 분석합니다.',
    checks: [
      '하드코딩된 시크릿 · API 키 탐지',
      '환경변수 직접 노출 여부 확인',
      '컨테이너 root 권한 · 특권 모드',
      '불필요하게 열린 포트 탐지',
      'Docker 이미지 취약점 스캔',
    ],
  },
  {
    key: 'RAW_UPLOADED',
    statusKey: 'RAW_UPLOADED',
    code: 'RAW_UPLOADED',
    label: '결과 저장',
    doing: '원본 스캔 결과를 저장하고 AI 분석을 준비합니다.',
    checks: ['S3 원본 결과 업로드', 'AI 분석 작업 발행', 'Finding 파싱 준비'],
  },
  {
    key: 'ANALYSIS_RUNNING',
    statusKey: 'RAW_UPLOADED',
    code: 'ANALYSIS_RUNNING',
    label: 'AI 분석',
    doing: 'AI가 각 취약점의 원인을 설명하고 수정 코드를 작성합니다.',
    checks: [
      '취약점 심각도 · 영향 범위 분석',
      '발견 원인 한국어 해설 생성',
      '파일별 수정 코드(패치) 생성',
      '참고 링크 · 권장 조치 정리',
    ],
  },
  {
    key: 'DONE',
    statusKey: 'DONE',
    code: 'DONE',
    label: '완료',
    doing: '모든 분석이 완료되었습니다.',
    checks: ['탐지 결과 DB 저장', '수정 가이드 확정', '결과 화면 준비 완료'],
  },
] as const;

const securityTips = [
  { label: '환경변수 분리', code: 'DB_PASSWORD=${DB_PASSWORD}' },
  { label: '포트 바인딩 제한', code: 'ports:\n  - "127.0.0.1:5432:5432"' },
  { label: 'SSH root 로그인 차단', code: 'PermitRootLogin no' },
  { label: '비특권 유저로 실행', code: 'USER node' },
] as const;

function resolveActiveStepIndex(statusData: ScanProgressStatusData | null) {
  if (!statusData) return 0;
  if (statusData.status === 'DONE') return progressSteps.length - 1;
  if (statusData.status === 'FAILED' || statusData.status === 'CANCELED')
    return Math.max(progressSteps.findIndex((s) => s.statusKey === 'RAW_UPLOADED'), 0);

  const progressStep = statusData.progressStep?.trim();
  if (progressStep) {
    const idx = progressSteps.findIndex((s) => s.key === progressStep || s.code === progressStep);
    if (idx >= 0) return idx;
  }
  return Math.max(progressSteps.findIndex((s) => s.statusKey === statusData.status), 0);
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
  const [typedCode, setTypedCode] = useState('');

  useEffect(() => {
    let charIndex = 0;
    const tip = securityTips[tipIndex];
    setTypedCode('');
    const id = window.setInterval(() => {
      charIndex += 1;
      setTypedCode(tip.code.slice(0, charIndex));
      if (charIndex >= tip.code.length) {
        window.clearInterval(id);
        window.setTimeout(() => setTipIndex((i) => (i + 1) % securityTips.length), 1600);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [tipIndex]);

  const activeStep = progressSteps[activeStepIndex];

  const isFailed = useMemo(
    () => !!statusData && (statusData.status === 'FAILED' || statusData.status === 'CANCELED'),
    [statusData],
  );

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
    return (
      <div className="bg-neutral-50 px-8 py-16 text-sm text-neutral-500">
        확인할 수 있는 스캔 상태가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── 상단: 진행률 + 현재 단계 ── */}
      <div className="bg-white border border-neutral-100 px-8 py-8">
        {/* 컨트롤 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.28em] text-neutral-400 uppercase">Scan Status</span>
            <span className="font-mono text-[10px] text-neutral-300">#{statusData.scanId}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-500 hover:text-black transition">
              <input
                checked={isAutoRefreshEnabled}
                className="h-3.5 w-3.5 accent-black"
                onChange={(e) => onAutoRefreshChange(e.target.checked)}
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

        {/* 진행률 + 상태 */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2 leading-none">
              <span className="text-7xl font-black tracking-tight text-black md:text-8xl">
                {isFailed ? (statusData.status === 'FAILED' ? '오류' : '취소') : Math.round(progressPercent)}
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

          {/* 상태 배지 */}
          <span className={`self-start rounded-full px-3 py-1 font-mono text-[11px] font-bold tracking-widest ${
            statusData.status === 'DONE'
              ? 'bg-[#D4FC64] text-black'
              : statusData.status === 'FAILED'
              ? 'bg-rose-100 text-rose-700'
              : statusData.status === 'CANCELED'
              ? 'bg-neutral-100 text-neutral-500'
              : 'bg-[#EDFFC0] text-[#5A8A00] animate-pulse'
          }`}>
            {statusData.status}
          </span>
        </div>

        {/* 진행 바 */}
        <div className="mt-8 h-1 rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-black transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 스텝 트래커 */}
        <div className="mt-4 flex">
          {progressSteps.map((step, idx) => {
            const isDone = idx < activeStepIndex || (isTerminal && idx <= activeStepIndex);
            const isActive = idx === activeStepIndex && !isTerminal;
            return (
              <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                  isDone
                    ? 'bg-black text-white'
                    : isActive
                    ? 'bg-[#D4FC64] text-black ring-2 ring-[#D4FC64] ring-offset-2'
                    : 'bg-neutral-100 text-neutral-400'
                }`}>
                  {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                </div>
                <span className={`hidden text-center font-mono text-[9px] leading-tight sm:block ${
                  isActive ? 'font-bold text-black' : isDone ? 'text-neutral-400' : 'text-neutral-300'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* 타임스탬프 */}
        <div className="mt-5 flex flex-wrap gap-4 font-mono text-[11px] text-neutral-400">
          <span>requested {formatDateTime(statusData.requestedAt)}</span>
          {statusData.startedAt && <span>started {formatDateTime(statusData.startedAt)}</span>}
          {statusData.completedAt && <span>completed {formatDateTime(statusData.completedAt)}</span>}
        </div>
      </div>

      {/* ── 하단: 2열 패널 ── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* 왼쪽: 지금 확인하는 항목 */}
        <div className="border border-neutral-100 bg-white px-6 py-6">
          <p className="font-mono text-[10px] font-bold tracking-[0.28em] text-neutral-400 uppercase">지금 확인하는 항목</p>
          <p className="mt-3 text-sm font-black text-black">{activeStep.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{activeStep.doing}</p>

          <ul className="mt-4 space-y-2.5">
            {activeStep.checks.map((check, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-neutral-700">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isTerminal ? 'bg-[#9FCC2E]' : 'bg-neutral-300'}`} />
                {check}
              </li>
            ))}
          </ul>

          {!isTerminal && (
            <p className="mt-5 text-xs leading-relaxed text-neutral-400">
              보통 10~30초 소요됩니다. 화면을 벗어나도 돌아오면 상태를 이어서 확인할 수 있습니다.
            </p>
          )}
        </div>

        {/* 오른쪽: 보안 인사이트 터미널 */}
        <div className="border border-neutral-100 bg-white px-6 py-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] font-bold tracking-[0.28em] text-neutral-400 uppercase">Security Insight</p>
            <span className="font-mono text-[10px] text-neutral-300">{tipIndex + 1} / {securityTips.length}</span>
          </div>
          <p className="mt-2 text-sm font-bold text-black">{securityTips[tipIndex].label}</p>

          {/* 터미널 (어두운 카드로만 한정) */}
          <div className="mt-3 overflow-hidden rounded-lg bg-[#111]">
            <div className="flex items-center gap-1.5 border-b border-neutral-800 px-4 py-2.5">
              <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
              <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
              <span className="h-2 w-2 rounded-full bg-[#28C840]" />
              <span className="ml-2 font-mono text-[10px] text-neutral-500">secure-config.yml</span>
            </div>
            <div className="min-h-[80px] px-5 py-4 font-mono text-sm text-[#D4FC64]">
              <span className="whitespace-pre-wrap">{typedCode}</span>
              <span className="ml-0.5 inline-block h-4 w-[6px] translate-y-0.5 animate-pulse bg-[#D4FC64]" />
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-neutral-400">
            스캔이 진행되는 동안 이런 설정도 함께 확인해 보세요. SSAfer는 이와 같은 패턴을 자동으로 탐지합니다.
          </p>

        </div>
      </div>
    </div>
  );
}

export default ScanProgressPanel;
