import { Bot, Clock3, RefreshCw, Radio, Workflow } from 'lucide-react';

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
          className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-black hover:text-black"
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw className="h-4 w-4" />
          상태 새로고침
        </button>
      }
      description="프로젝트에 연결된 로컬 에이전트의 접속 상태와 최근 활동 시간을 확인합니다."
      eyebrow="AGENT"
      title="로컬 에이전트 상태"
    >
      {isLoading ? (
        <div className="border border-neutral-200 bg-[#fafafa] px-4 py-5 text-sm text-neutral-600">
          에이전트 상태를 불러오는 중입니다...
        </div>
      ) : errorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">{errorMessage}</div>
      ) : agentStatus ? (
        <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 xl:grid-cols-4">
          <article className="bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">연결 상태</p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getAgentStatusClassName(agentStatus.status)}`}
              >
                {getAgentStatusLabel(agentStatus.status)}
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-black">
                <Bot className="h-4 w-4" />
                Agent #{agentStatus.agentId}
              </span>
            </div>
          </article>

          <article className="bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">연결 시각</p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-black">
              <Radio className="h-4 w-4" />
              {formatDateTime(agentStatus.connectedAt)}
            </p>
          </article>

          <article className="bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">마지막 응답</p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-black">
              <Clock3 className="h-4 w-4" />
              {formatDateTime(agentStatus.lastSeenAt)}
            </p>
          </article>

          <article className="bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">현재 작업</p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-black">
              <Workflow className="h-4 w-4" />
              {agentStatus.currentTaskType ?? '대기 중'}
            </p>
          </article>
        </div>
      ) : (
        <div className="border border-neutral-200 bg-[#fafafa] px-4 py-5 text-sm text-neutral-600">
          이 프로젝트에 연결된 로컬 에이전트가 아직 없습니다.
        </div>
      )}
    </SectionPanel>
  );
}

export default AgentStatusCard;
