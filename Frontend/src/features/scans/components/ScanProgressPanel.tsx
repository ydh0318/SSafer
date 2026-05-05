import { CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react';

import MetricCard from '../../../components/common/MetricCard';
import PixelGoose from '../../../components/common/PixelGoose';
import SectionPanel from '../../../components/common/SectionPanel';
import type { ScanProgressStatusData } from '../../../types/scan';
import { formatDateTime, getScanStatusLabel, isTerminalScanStatus } from '../utils/scanPresentation';
import ScanStatusBadge from './ScanStatusBadge';

type ScanProgressPanelProps = {
  statusData: ScanProgressStatusData | null;
  isLoading: boolean;
  errorMessage: string | null;
  isAutoRefreshEnabled: boolean;
  onRefresh: () => void;
  onAutoRefreshChange: (nextValue: boolean) => void;
};

const progressSteps = [
  { key: 'REQUESTED', label: '요청 등록', description: '스캔 요청이 생성되었습니다.' },
  { key: 'QUEUED', label: '대기', description: '실행 순서를 기다리는 중입니다.' },
  { key: 'RUNNING', label: '분석 진행', description: '에이전트 실행 또는 분석이 진행 중입니다.' },
  { key: 'RAW_UPLOADED', label: '원본 업로드', description: '원본 스캔 결과 파일 업로드가 완료되었습니다.' },
  { key: 'DONE', label: '완료', description: '분석이 완료되어 결과를 볼 수 있습니다.' },
];

function ScanProgressPanel({
  statusData,
  isLoading,
  errorMessage,
  isAutoRefreshEnabled,
  onRefresh,
  onAutoRefreshChange,
}: ScanProgressPanelProps) {
  const isTerminal = statusData ? isTerminalScanStatus(statusData.status) : false;
  const activeStepIndex = statusData
    ? Math.max(progressSteps.findIndex((step) => step.key === statusData.status), 0)
    : 0;
  const progressPercent = statusData ? Math.min(((activeStepIndex + 1) / progressSteps.length) * 100, 100) : 0;

  return (
    <SectionPanel
      action={
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-600">
            <input
              checked={isAutoRefreshEnabled}
              className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
              onChange={(event) => onAutoRefreshChange(event.target.checked)}
              type="checkbox"
            />
            자동 새로고침
          </label>
          <button
            className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-black hover:text-black"
            onClick={onRefresh}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            지금 새로고침
          </button>
        </div>
      }
      description="스캔 요청 이후 현재 단계, 주요 시각, 오류 여부를 한 화면에서 계속 확인할 수 있습니다."
      eyebrow="SCAN PROGRESS"
      title="스캔 진행 현황"
    >
      {isLoading ? (
        <div className="border border-neutral-200 bg-[#fafafa] px-4 py-5 text-sm text-neutral-600">스캔 상태를 불러오는 중입니다...</div>
      ) : errorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">{errorMessage}</div>
      ) : statusData ? (
        <div className="space-y-6">
          <div className="border border-neutral-200 bg-[#fafafa] p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-5">
                <PixelGoose
                  mood={
                    statusData.status === 'DONE'
                      ? 'victory'
                      : statusData.status === 'FAILED'
                        ? 'alert'
                        : statusData.status === 'RUNNING'
                          ? 'working'
                          : 'idle'
                  }
                  size={76}
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ScanStatusBadge status={statusData.status} />
                    <span className="bg-black px-2.5 py-1 text-xs font-bold text-white">Scan #{statusData.scanId}</span>
                  </div>
                  <p className="mt-3 text-2xl font-black tracking-tight text-black">{getScanStatusLabel(statusData.status)}</p>
                  <p className="mt-2 text-sm leading-7 text-neutral-600">
                    {isTerminal
                      ? `현재 스캔은 ${getScanStatusLabel(statusData.status)} 상태입니다.`
                      : '스캔이 진행 중이며 5초마다 상태가 자동으로 갱신됩니다.'}
                  </p>
                </div>
              </div>

              <div className="min-w-[240px] flex-1 lg:max-w-md">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">
                  <span>진행률</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden bg-neutral-200">
                  <div className="h-full bg-black transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard helper="백엔드가 현재 보고한 단계 값입니다." label="현재 단계" tone="sky" value={statusData.progressStep ?? '-'} />
            <MetricCard helper="스캔 요청이 생성된 시각입니다." label="요청 시각" tone="plain" value={formatDateTime(statusData.requestedAt)} />
            <MetricCard helper="실제 처리 시작 시각입니다." label="시작 시각" tone="amber" value={formatDateTime(statusData.startedAt)} />
            <MetricCard helper="완료 또는 종료 시각입니다." label="종료 시각" tone={isTerminal ? 'green' : 'plain'} value={formatDateTime(statusData.completedAt)} />
          </div>

          <div className="grid gap-3 xl:grid-cols-5">
            {progressSteps.map((step, index) => {
              const isDone = index < activeStepIndex;
              const isActive = index === activeStepIndex;

              return (
                <article
                  className={`border p-4 transition ${
                    isDone
                      ? 'border-black bg-black text-white'
                      : isActive
                        ? 'border-black bg-white text-black'
                        : 'border-neutral-200 bg-[#fafafa] text-neutral-500'
                  }`}
                  key={step.key}
                >
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isActive ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="grid h-4 w-4 place-items-center border border-current text-[10px] font-bold">
                        {index + 1}
                      </span>
                    )}
                    <span className="text-[11px] font-bold uppercase tracking-[0.24em]">0{index + 1}</span>
                  </div>
                  <p className="mt-3 text-sm font-black">{step.label}</p>
                  <p className={`mt-2 text-xs leading-6 ${isDone ? 'text-neutral-300' : isActive ? 'text-neutral-600' : 'text-neutral-500'}`}>
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="border border-neutral-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">오류 또는 추가 안내</p>
            <p className="mt-3 text-sm leading-7 text-neutral-700">
              {statusData.errorMessage ?? '현재 전달된 오류 메시지는 없습니다. 스캔이 계속 진행 중이면 잠시 후 자동으로 갱신됩니다.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-neutral-200 bg-[#fafafa] px-4 py-5 text-sm text-neutral-600">표시할 스캔 상태 정보가 없습니다.</div>
      )}
    </SectionPanel>
  );
}

export default ScanProgressPanel;
