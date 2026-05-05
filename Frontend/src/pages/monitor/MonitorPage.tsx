import { AlertCircle, BellRing, Wifi, WifiOff } from 'lucide-react';

import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
import { monitorFeed, monitorProjects, severityMeta } from '../../mocks/ssaferShowcase';

function MonitorPage() {
  return (
    <section className="space-y-8">
      <PageHero
        aside={
          <div className="theme-monitor-banner border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-sm border border-neutral-200 px-4 py-3 text-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#3DDC84]" />
              <span className="font-mono text-xs">실시간 연결 중 · WebSocket</span>
            </div>
          </div>
        }
        description="Local Agent 연결 상태와 최근 보안 변화, 현재 실행 중인 작업을 한눈에 확인할 수 있습니다."
        eyebrow="MONITOR"
        title="실시간 모니터링"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="border border-neutral-200 bg-white p-5">
          <div className="text-[10px] font-bold tracking-[0.24em] text-neutral-500">ONLINE AGENTS</div>
          <div className="mt-2 text-4xl font-black">2</div>
          <div className="mt-1 text-xs text-neutral-500">/ 4 프로젝트</div>
        </article>
        <article className="border border-neutral-200 bg-white p-5">
          <div className="text-[10px] font-bold tracking-[0.24em] text-neutral-500">현재 실행 중인 작업</div>
          <div className="mt-2 text-4xl font-black">1</div>
          <div className="mt-1 font-mono text-xs text-neutral-500">PATCH_APPLY</div>
        </article>
        <article className="theme-monitor-danger border border-neutral-200 bg-[#FFE5E5] p-5">
          <div className="text-[10px] font-bold tracking-[0.24em]">새로 발생 (24h)</div>
          <div className="mt-2 text-4xl font-black">+3</div>
          <div className="mt-1 text-xs">CRITICAL findings</div>
        </article>
        <article className="theme-monitor-success border border-neutral-200 bg-[#E6F9EE] p-5">
          <div className="text-[10px] font-bold tracking-[0.24em]">해결 (24h)</div>
          <div className="mt-2 text-4xl font-black">-12</div>
          <div className="mt-1 text-xs">RESOLVED findings</div>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
            <h2 className="font-black tracking-tight">Local Agent 상태</h2>
            <span className="text-xs text-neutral-500">5초마다 업데이트</span>
          </div>
          {monitorProjects.map((project) => (
            <div className="grid grid-cols-12 items-center gap-4 border-b border-neutral-100 px-5 py-4 last:border-b-0" key={project.id}>
              <div className="col-span-4">
                <div className="font-bold">{project.name}</div>
                <div className="font-mono text-[11px] text-neutral-400">
                  projectId #{project.id} · agentId #{project.agentId}
                </div>
              </div>
              <div className="col-span-2">
                <div
                  className={`flex items-center gap-2 text-sm font-bold ${
                    project.agentStatus === 'ONLINE'
                      ? 'text-[#3DDC84]'
                      : project.agentStatus === 'ERROR'
                        ? 'text-[#FF8A33]'
                        : 'text-neutral-400'
                  }`}
                >
                  {project.agentStatus === 'ONLINE' ? (
                    <Wifi className="h-4 w-4" />
                  ) : project.agentStatus === 'ERROR' ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <WifiOff className="h-4 w-4" />
                  )}
                  {project.agentStatus}
                </div>
                <div className="mt-1 font-mono text-[10px] text-neutral-400">last: {project.lastSeenAt}</div>
              </div>
              <div className="col-span-3">
                <div className="text-[10px] font-bold tracking-[0.24em] text-neutral-500">CURRENT TASK</div>
                <div className="mt-1 font-mono text-xs">
                  {project.currentTaskType ? (
                    <span className="bg-black px-1.5 py-0.5 text-white">{project.currentTaskType}</span>
                  ) : (
                    <span className="text-neutral-400">idle</span>
                  )}
                </div>
              </div>
              <div className="col-span-1 text-center">
                <div className="text-[10px] font-bold tracking-[0.24em] text-neutral-500">CRIT</div>
                <div className={`text-2xl font-black ${project.openCritical > 0 ? 'text-[#E63946]' : 'text-neutral-300'}`}>
                  {project.openCritical}
                </div>
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                {project.monitorEnabled ? (
                  <span className="bg-[#3D5AFE] px-2 py-0.5 text-[10px] font-bold tracking-[0.22em] text-white">MONITOR</span>
                ) : null}
                <button className="bg-black px-3 py-1.5 text-xs font-bold text-white" type="button">
                  점검
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className="border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
            <span className="flex items-center gap-2 font-bold">
              <BellRing className="h-4 w-4" />
              알림 피드
            </span>
            <span className="bg-[#E63946] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.22em] text-white">3 NEW</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {monitorFeed.map((item) => (
              <div className="flex items-start gap-3 px-5 py-3" key={`${item.time}-${item.text}`}>
                <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: severityMeta[item.sev].bg }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.text}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-neutral-400">{item.detail}</div>
                </div>
                <div className="text-[10px] text-neutral-400">{item.time}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

export default MonitorPage;
