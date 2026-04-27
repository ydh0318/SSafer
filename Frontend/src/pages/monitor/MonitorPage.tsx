import { SeverityBadge, StatusPill } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';
import { monitorEvents } from '../../mocks/ssaferMockData';

function MonitorPage() {
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <SectionPanel description="프로젝트별 이상 이벤트 목록과 상세 조회 화면입니다." eyebrow="Monitor events" title="이상 이벤트 목록">
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

      <ApiEndpointList compact screenId="monitor" />
    </div>
  );
}

export default MonitorPage;
