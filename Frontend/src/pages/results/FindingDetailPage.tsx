import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { SeverityBadge, StatusPill } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';
import BeforeAfterDiff from '../../features/results/components/BeforeAfterDiff';
import { findings, formatFindingLocation } from '../../mocks/ssaferMockData';

function FindingDetailPage() {
  const { findingId = 'FND-0001' } = useParams<{ findingId: string }>();
  const finding = findings.find((item) => item.id === findingId) ?? findings[0];

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionPanel
          description={`${formatFindingLocation(finding)} · ${finding.evidence}`}
          eyebrow={finding.ruleId}
          title={finding.title}
        >
          <div className="flex flex-wrap gap-2">
            <SeverityBadge value={finding.severity} />
            <StatusPill value={finding.status} />
          </div>
          <div className="mt-6 space-y-4">
            <InfoBlock body={finding.plain} title="쉽게 말하면" />
            <InfoBlock body={finding.whyRisky} title="왜 위험한가" />
            <InfoBlock body={finding.impact} title="공격 시나리오 / 실제 영향" />
            <InfoBlock body={finding.fix} title="수정안" />
          </div>
        </SectionPanel>

        <SectionPanel description="승인 API와 내부 패치 결과 보고 API가 이 상세 화면에서 이어집니다." eyebrow="Patch approval" title="Before / After Diff">
          <BeforeAfterDiff after={finding.after} before={finding.before} />
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800" type="button">
              <CheckCircle2 className="h-4 w-4" />
              취약점 패치 승인
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-400" type="button">
              <ExternalLink className="h-4 w-4" />
              참고 링크
            </button>
          </div>
        </SectionPanel>
      </div>

      <ApiEndpointList compact screenId="findingDetail" />
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-black text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
    </div>
  );
}

export default FindingDetailPage;
