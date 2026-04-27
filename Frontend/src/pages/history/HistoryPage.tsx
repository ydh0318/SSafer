import { SeverityBadge } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';

function HistoryPage() {
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <SectionPanel description="사용자 단위 전체 스캔 이력을 보고 두 scanId를 선택해 비교합니다." eyebrow="History compare" title="히스토리 / 결과 비교">
        <div className="grid gap-4 lg:grid-cols-2">
          <CompareBox high="1" scan="scan-c91" title="Base Scan" critical="0" />
          <CompareBox high="2" scan="scan-a36" title="Target Scan" critical="1" />
        </div>
        <div className="mt-6 rounded-lg bg-slate-50 p-5">
          <h3 className="font-black text-slate-950">비교 결과</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Critical +1, High +1, Medium +2. 새로 생긴 secret finding을 우선 처리해야 합니다.</p>
        </div>
      </SectionPanel>

      <ApiEndpointList compact screenId="history" />
    </div>
  );
}

function CompareBox({ title, scan, critical, high }: { title: string; scan: string; critical: string; high: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-5">
      <p className="text-sm font-black text-slate-400">{title}</p>
      <h3 className="mt-2 font-mono text-xl font-black text-slate-950">{scan}</h3>
      <div className="mt-4 flex gap-2">
        <SeverityBadge value="CRITICAL" />
        <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-700">{critical}</span>
        <SeverityBadge value="HIGH" />
        <span className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-black text-orange-700">{high}</span>
      </div>
    </div>
  );
}

export default HistoryPage;
