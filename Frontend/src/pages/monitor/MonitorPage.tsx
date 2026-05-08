import { AlertCircle, BellRing, Wifi, WifiOff } from 'lucide-react';

import FeatureBanner from '../../components/common/FeatureBanner';
import FeatureInfoCard from '../../components/common/FeatureInfoCard';

const monitorProjects = [
  { id: 101, name: 'shopping-mall-api', monitorEnabled: true, agentStatus: 'ONLINE', agentId: 1, lastSeenAt: '5초 전', currentTaskType: null, openCritical: 2 },
  { id: 102, name: 'admin-dashboard', monitorEnabled: false, agentStatus: 'OFFLINE', agentId: 2, lastSeenAt: '3시간 전', currentTaskType: null, openCritical: 0 },
  { id: 103, name: 'auth-service', monitorEnabled: true, agentStatus: 'ONLINE', agentId: 3, lastSeenAt: '방금', currentTaskType: 'PATCH_APPLY', openCritical: 0 },
  { id: 105, name: 'media-uploader', monitorEnabled: true, agentStatus: 'ERROR', agentId: 5, lastSeenAt: '10분 전', currentTaskType: null, openCritical: 1 },
] as const;

const monitorFeed = [
  { time: '방금', sev: 'CRITICAL', text: 'shopping-mall-api: 새 finding +1', detail: 'CVE-2024-5678' },
  { time: '5분 전', sev: 'INFO', text: 'auth-service: PATCH_APPLY 시작', detail: 'findingId #2010' },
  { time: '12분 전', sev: 'HIGH', text: 'media-uploader: Agent ERROR', detail: 'connection lost' },
  { time: '1시간 전', sev: 'INFO', text: 'shopping-mall-api: scan #1001 완료', detail: 'findings: 17' },
  { time: '3시간 전', sev: 'INFO', text: 'admin-dashboard: 12개 RESOLVED', detail: 'auto-applied' },
] as const;

const feedDotColor: Record<(typeof monitorFeed)[number]['sev'], string> = {
  CRITICAL: '#E63946',
  HIGH: '#FF8A33',
  INFO: '#9CA3AF',
};

function MonitorPage() {
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FeatureInfoCard eyebrow="ONLINE AGENTS" title={<div className="text-4xl font-black">2</div>} description="/ 4 프로젝트" />
        <FeatureInfoCard eyebrow="RUNNING TASK" title={<div className="text-4xl font-black">1</div>} description="PATCH_APPLY" />
        <FeatureInfoCard eyebrow="NEW IN 24H" title={<div className="text-4xl font-black">+3</div>} description="Critical findings" tone="danger" />
        <FeatureInfoCard eyebrow="RESOLVED IN 24H" title={<div className="text-4xl font-black">-12</div>} description="Resolved findings" tone="success" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border border-black/5 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
            <h2 className="font-black tracking-tight">Local Agent 상태</h2>
            <span className="text-xs text-neutral-500">5초마다 갱신</span>
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
                      ? 'text-[#0A8F4E]'
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
                  <span className="theme-accent-card bg-[#D4FC64] px-2 py-0.5 text-[10px] font-bold tracking-[0.22em] !text-black">MONITOR</span>
                ) : null}
                <button className="bg-black px-3 py-1.5 text-xs font-bold text-white" type="button">
                  보기
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className="border border-black/5 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
            <span className="flex items-center gap-2 font-bold">
              <BellRing className="h-4 w-4" />
              최근 알림
            </span>
            <span className="bg-[#E63946] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.22em] text-white">3 NEW</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {monitorFeed.map((item) => (
              <div className="flex items-start gap-3 px-5 py-3" key={`${item.time}-${item.text}`}>
                <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: feedDotColor[item.sev] }} />
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
