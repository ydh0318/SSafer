import { SeverityBadge, StatusPill } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import { monitorEvents } from '../../mocks/ssaferMockData';

function MonitorPage() {
  return (
    <SectionPanel
      description="프로젝트에서 감지된 주요 이벤트를 시간순으로 확인할 수 있습니다."
      eyebrow="Monitor events"
      title="모니터링 이벤트"
    >
      <div className="space-y-3">
        {monitorEvents.map((event) => (
          <article className="rounded-lg border border-slate-200 p-4" key={event.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge value={event.level} />
                <StatusPill value={event.status} />
              </div>
              <span className="text-sm font-bold text-slate-400">{event.time}</span>
            </div>
            <p className="mt-3 text-lg font-black text-slate-950">{event.title}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">{event.id}</p>
          </article>
        ))}
      </div>
    </SectionPanel>
  );
}

export default MonitorPage;
