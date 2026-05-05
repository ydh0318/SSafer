import SectionPanel from '../../../components/common/SectionPanel';
import type { AgentStatusResponseData } from '../../../types/scan';
import {
  formatDateTime,
  getAgentStatusClassName,
  getAgentStatusLabel,
} from '../../scans/utils/scanPresentation';

type AgentStatusCardProps = {
  agentStatus: AgentStatusResponseData | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
};

function AgentStatusCard({ agentStatus, isLoading, errorMessage, onRefresh }: AgentStatusCardProps) {
  return (
    <SectionPanel
      action={
        <button
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          onClick={onRefresh}
          type="button"
        >
          상태 새로고침
        </button>
      }
      description="현재 프로젝트에 연결된 로컬 에이전트의 접속 상태와 마지막 활동 시각을 확인합니다."
      eyebrow="에이전트"
      title="로컬 에이전트 상태"
    >
      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          로컬 에이전트 상태를 불러오는 중입니다...
        </div>
      ) : errorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : agentStatus ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">연결 상태</p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getAgentStatusClassName(agentStatus.status)}`}
              >
                {getAgentStatusLabel(agentStatus.status)}
              </span>
              <span className="text-sm font-semibold text-slate-900">에이전트 #{agentStatus.agentId}</span>
            </div>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">연결 시각</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">{formatDateTime(agentStatus.connectedAt)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">마지막 응답</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">{formatDateTime(agentStatus.lastSeenAt)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">현재 작업</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">{agentStatus.currentTaskType ?? '없음'}</p>
          </article>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          이 프로젝트에 연결된 로컬 에이전트 정보가 없습니다.
        </div>
      )}
    </SectionPanel>
  );
}

export default AgentStatusCard;
