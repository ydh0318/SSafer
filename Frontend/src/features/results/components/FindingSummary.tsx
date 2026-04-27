import MetricCard from '../../../components/common/MetricCard';
import { countFindingSeverity, type FindingMock } from '../../../mocks/ssaferMockData';

function FindingSummary({ findings }: { findings: FindingMock[] }) {
  const totals = countFindingSeverity(findings);

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <MetricCard helper="결과 요약 API" label="Critical" tone="red" value={totals.critical} />
      <MetricCard helper="필터 가능" label="High" tone="orange" value={totals.high} />
      <MetricCard helper="category 필터" label="Medium" tone="amber" value={totals.medium} />
      <MetricCard helper="status/page/size" label="Low" tone="sky" value={totals.low} />
    </div>
  );
}

export default FindingSummary;
