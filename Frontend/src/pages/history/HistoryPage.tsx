import { SeverityBadge } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';

function HistoryPage() {
  return (
    <SectionPanel
      description="이전 스캔과 최근 스캔의 차이를 비교해 위험도 변화를 빠르게 확인합니다."
      eyebrow="History compare"
      title="이전 결과 비교"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <CompareBox critical="0" high="1" scan="scan-c91" title="기준 스캔" />
        <CompareBox critical="1" high="2" scan="scan-a36" title="비교 스캔" />
      </div>
      <div className="mt-6 rounded-lg bg-slate-50 p-5">
        <h3 className="font-black text-slate-950">비교 요약</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Critical 1건, High 1건이 증가했고 신규 secret 관련 이슈가 추가되었습니다.
        </p>
      </div>
    </SectionPanel>
  );
}

function CompareBox({
  title,
  scan,
  critical,
  high,
}: {
  title: string;
  scan: string;
  critical: string;
  high: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-5">
      <p className="text-sm font-black text-slate-400">{title}</p>
      <h3 className="mt-2 font-mono text-xl font-black text-slate-950">{scan}</h3>
      <div className="mt-4 flex gap-2">
        <SeverityBadge value="CRITICAL" />
        <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-700">
          {critical}
        </span>
        <SeverityBadge value="HIGH" />
        <span className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-black text-orange-700">
          {high}
        </span>
      </div>
    </div>
  );
}

export default HistoryPage;
