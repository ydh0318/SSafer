import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import FeatureBanner from '../../components/common/FeatureBanner';
import FeatureInfoCard from '../../components/common/FeatureInfoCard';
import { ROUTES } from '../../constants/routes';
import { getProjectAgentStatus } from '../../features/agents/api/agents';
import { getProjects } from '../../features/projects/api/projects';
import { formatDateTime, getAgentStatusLabel } from '../../features/scans/utils/scanPresentation';
import type { AgentStatus, AgentStatusResponseData } from '../../types/scan';
import type { ProjectListItemData } from '../../types/project';

const agentStatusColorMap: Record<AgentStatus, string> = {
  ONLINE: 'text-[#0A8F4E]',
  ERROR: 'text-[#FF8A33]',
  OFFLINE: 'text-neutral-400',
};

function AgentStatusIcon({ status }: { status: AgentStatus }) {
  if (status === 'ONLINE') return <Wifi className="h-4 w-4" />;
  if (status === 'ERROR') return <AlertCircle className="h-4 w-4" />;
  return <WifiOff className="h-4 w-4" />;
}

function MonitorPage() {
  const [projects, setProjects] = useState<ProjectListItemData[]>([]);
  const [agentStatusMap, setAgentStatusMap] = useState<Record<number, AgentStatusResponseData | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async (signal?: { cancelled: boolean }) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const projectData = await getProjects({ size: 100 });

      if (signal?.cancelled) return;

      setProjects(projectData.items);

      const statusEntries = await Promise.all(
        projectData.items.map(async (project) => {
          const status = await getProjectAgentStatus(String(project.projectId)).catch(() => null);
          return [project.projectId, status] as const;
        }),
      );

      if (signal?.cancelled) return;

      setAgentStatusMap(Object.fromEntries(statusEntries));
    } catch (error) {
      if (signal?.cancelled) return;
      const raw = error instanceof Error ? error.message : '';
      const isAuthError = /authentication|token|unauthorized|인증|권한/i.test(raw);
      setErrorMessage(
        isAuthError
          ? '로그인 세션이 만료되었습니다. 페이지를 새로고침하거나 다시 로그인해 주세요.'
          : '에이전트 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      if (!signal?.cancelled) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    void loadData(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadData]);

  const agentStatuses = Object.values(agentStatusMap);
  const onlineCount = agentStatuses.filter((s) => s?.status === 'ONLINE').length;
  const runningTaskCount = agentStatuses.filter((s) => Boolean(s?.currentTaskType)).length;

  return (
    <section className="space-y-8">
      <FeatureBanner
        aside={
          <FeatureInfoCard
            className="min-w-[280px]"
            description="5초 단위 heartbeat와 WebSocket 상태를 기준으로 Agent 연결 상태를 추적합니다."
            eyebrow="LIVE"
            title={<div className="text-lg font-black">실시간 연결 모니터</div>}
            tone="dark"
          />
        }
        description="Local Agent 연결 상태, 최근 알림, 새로 생긴 위험과 해결된 위험을 한 화면에서 바로 확인할 수 있도록 구성합니다."
        eyebrow="MONITOR"
        title={
          <div>
            <div className="text-sm text-neutral-500">실시간 연결과 알림 흐름</div>
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
                    {agentStatus ? ` · agentId #${agentStatus.agentId}` : ''}
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
