import MetricCard from '../../../components/common/MetricCard';
import { countFindingSeverity, type FindingMock } from '../../../mocks/ssaferMockData';

function FindingSummary({ findings }: { findings: FindingMock[] }) {
  const totals = countFindingSeverity(findings);

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <MetricCard helper="즉시 조치가 필요한 항목" label="Critical" tone="red" value={totals.critical} />
      <MetricCard helper="높은 우선순위의 위험" label="High" tone="orange" value={totals.high} />
      <MetricCard helper="점검이 필요한 중간 위험" label="Medium" tone="amber" value={totals.medium} />
      <MetricCard helper="참고 수준의 낮은 위험" label="Low" tone="sky" value={totals.low} />
    </div>
  );
}

export default FindingSummary;
