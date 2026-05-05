import MetricCard from '../../../components/common/MetricCard';
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

function ScanProgressPanel({
  statusData,
  isLoading,
  errorMessage,
  isAutoRefreshEnabled,
  onRefresh,
  onAutoRefreshChange,
}: ScanProgressPanelProps) {
  const isTerminal = statusData ? isTerminalScanStatus(statusData.status) : false;

  return (
    <SectionPanel
      action={
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <input
              checked={isAutoRefreshEnabled}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              onChange={(event) => onAutoRefreshChange(event.target.checked)}
              type="checkbox"
            />
            자동 새로고침
          </label>
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            onClick={onRefresh}
            type="button"
          >
            지금 새로고침
          </button>
        </div>
      }
      description="스캔 등록 이후 현재 단계가 어디까지 진행됐는지 계속 확인할 수 있습니다."
      eyebrow="진행 상태"
      title="스캔 상태 모니터링"
    >
      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          스캔 상태를 불러오는 중입니다...
        </div>
      ) : errorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : statusData ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <ScanStatusBadge status={statusData.status} />
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">
              스캔 #{statusData.scanId}
            </span>
            <span className="text-sm text-slate-500">
              {isTerminal
                ? `현재 상태는 ${getScanStatusLabel(statusData.status)}입니다.`
                : '스캔이 진행 중이며 상태를 5초 주기로 다시 확인할 수 있습니다.'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              helper="백엔드가 반환한 현재 진행 단계입니다."
              label="현재 단계"
              tone="sky"
              value={statusData.progressStep ?? '-'}
            />
            <MetricCard
              helper="스캔이 등록된 시각입니다."
              label="요청 시각"
              tone="plain"
              value={formatDateTime(statusData.requestedAt)}
            />
            <MetricCard
              helper="실제 실행이 시작된 시각입니다."
              label="시작 시각"
              tone="amber"
              value={formatDateTime(statusData.startedAt)}
            />
            <MetricCard
              helper="완료 또는 종료된 시각입니다."
              label="종료 시각"
              tone={isTerminal ? 'green' : 'plain'}
              value={formatDateTime(statusData.completedAt)}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">오류 메시지</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {statusData.errorMessage ?? '현재 등록된 오류 메시지는 없습니다.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          조회할 스캔 상태 정보가 없습니다.
        </div>
      )}
    </SectionPanel>
  );
}

export default ScanProgressPanel;
