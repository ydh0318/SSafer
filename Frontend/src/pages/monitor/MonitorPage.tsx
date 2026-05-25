import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';

import FeatureBanner from '../../components/common/FeatureBanner';
import FeatureInfoCard from '../../components/common/FeatureInfoCard';
import PageBanner from '../../components/common/PageBanner';
import { ROUTES } from '../../constants/routes';
import useMonitorData from '../../features/monitor/hooks/useMonitorData';
import { formatDateTime, getAgentStatusLabel } from '../../features/scans/utils/scanPresentation';
import type { AgentStatus } from '../../types/scan';

function AgentStatusIcon({ status }: { status: AgentStatus }) {
  if (status === 'ONLINE') {
    return <Wifi className="h-4 w-4" />;
  }
  if (status === 'ERROR') {
    return <AlertCircle className="h-4 w-4" />;
  }
  return <WifiOff className="h-4 w-4" />;
}

function MonitorPage() {
  const {
    agentStatusColorMap,
    agentStatusMap,
    errorMessage,
    isLoading,
    loadData,
    onlineCount,
    projects,
    runningTaskCount,
  } = useMonitorData();

  return (
    <section className="space-y-8">
      <FeatureBanner
        aside={
          <FeatureInfoCard
            className="min-w-[280px]"
            description="실시간 알림과 위험 변화 추적 기능은 곧 추가될 예정입니다."
            eyebrow="COMING SOON"
            title={<div className="text-lg font-black">모니터링 서비스 준비 중</div>}
            tone="dark"
          />
        }
        description="프로젝트별 Local Agent의 연결 상태를 한눈에 확인할 수 있습니다."
        eyebrow="MONITOR"
        title={
          <div>
            <div className="text-sm text-neutral-500">Agent 연결 상태</div>
            <h1 className="mt-3 text-5xl font-black tracking-tight md:text-6xl">모니터</h1>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <FeatureInfoCard
          description={`/ ${isLoading ? '-' : projects.length} 프로젝트`}
          eyebrow="ONLINE AGENTS"
          title={<div className="text-4xl font-black">{isLoading ? '-' : onlineCount}</div>}
        />
        <FeatureInfoCard
          description="현재 실행 중인 작업"
          eyebrow="RUNNING TASK"
          title={<div className="text-4xl font-black">{isLoading ? '-' : runningTaskCount}</div>}
        />
      </div>

      <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <span className="mt-0.5 text-base">ⓘ</span>
        <div>
          <div className="font-bold">모니터링 서비스는 일부 기능만 준비 중이에요.</div>
          <div className="mt-1 text-xs leading-6 text-amber-800">
            지금은 Agent의 <span className="font-bold">연결 여부</span>만 확인할 수 있어요.
            실시간 알림이나 위험 변화 알림은 곧 만나보실 수 있어요.
            최신 상태가 궁금하시면 아래 <span className="font-bold">새로고침</span> 버튼을 눌러주세요.
          </div>
        </div>
      </div>

      {errorMessage ? <PageBanner message={errorMessage} tone="error" /> : null}

      <div className="border border-black/5 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="font-black tracking-tight">Local Agent 상태</h2>
          <button
            className="inline-flex items-center gap-2 border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isLoading}
            onClick={() => void loadData()}
            type="button"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-neutral-500">에이전트 상태를 불러오는 중입니다.</div>
        ) : projects.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-neutral-500">등록된 프로젝트가 없습니다.</div>
        ) : (
          projects.map((project) => {
            const agentStatus = agentStatusMap[project.projectId] ?? null;
            const status: AgentStatus = agentStatus?.status ?? 'OFFLINE';

            return (
              <div
                className="grid grid-cols-12 items-center gap-4 border-b border-neutral-100 px-5 py-4 last:border-b-0"
                key={project.projectId}
              >
                <div className="col-span-4">
                  <div className="font-bold">{project.name}</div>
                  <div className="font-mono text-[11px] text-neutral-400">
                    projectId #{project.projectId}
                    {agentStatus ? ` | agentId #${agentStatus.agentId}` : ''}
                  </div>
                </div>

                <div className="col-span-3">
                  <div className={`flex items-center gap-2 text-sm font-bold ${agentStatusColorMap[status]}`}>
                    <AgentStatusIcon status={status} />
                    {getAgentStatusLabel(status)}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-neutral-400">
                    last: {agentStatus?.lastSeenAt ? formatDateTime(agentStatus.lastSeenAt) : '-'}
                  </div>
                </div>

                <div className="col-span-3">
                  <div className="text-[10px] font-bold tracking-[0.24em] text-neutral-500">CURRENT TASK</div>
                  <div className="mt-1 font-mono text-xs">
                    {agentStatus?.currentTaskType ? (
                      <span className="bg-black px-1.5 py-0.5 text-white">{agentStatus.currentTaskType}</span>
                    ) : (
                      <span className="text-neutral-400">idle</span>
                    )}
                  </div>
                </div>

                <div className="col-span-2 flex justify-end gap-2">
                  {project.monitorEnabled ? (
                    <span className="bg-[#D4FC64] px-2 py-0.5 text-[10px] font-bold tracking-[0.22em] !text-black">
                      MONITOR
                    </span>
                  ) : null}
                  <Link
                    className="bg-black px-3 py-1.5 text-xs font-bold text-white transition hover:bg-neutral-800"
                    to={ROUTES.projectDetail.replace(':projectId', String(project.projectId))}
                  >
                    보기
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default MonitorPage;
