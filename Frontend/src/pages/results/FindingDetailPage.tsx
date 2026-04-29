import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { SeverityBadge, StatusPill } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import BeforeAfterDiff from '../../features/results/components/BeforeAfterDiff';
import { findings, formatFindingLocation } from '../../mocks/ssaferMockData';

function FindingDetailPage() {
  const { findingId = 'FND-0001' } = useParams<{ findingId: string }>();
  const finding = findings.find((item) => item.id === findingId) ?? findings[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionPanel
        description={`${formatFindingLocation(finding)} / ${finding.evidence}`}
        eyebrow={finding.ruleId}
        title={finding.title}
      >
        <div className="flex flex-wrap gap-2">
          <SeverityBadge value={finding.severity} />
          <StatusPill value={finding.status} />
        </div>
        <div className="mt-6 space-y-4">
          <InfoBlock body={finding.plain} title="무엇이 발견되었나요" />
          <InfoBlock body={finding.whyRisky} title="왜 위험한가요" />
          <InfoBlock body={finding.impact} title="영향 범위" />
          <InfoBlock body={finding.fix} title="권장 조치" />
        </div>
      </SectionPanel>

      <SectionPanel
        description="수정 전후의 차이를 비교해 적용 방향을 빠르게 검토할 수 있습니다."
        eyebrow="Patch preview"
        title="Before / After Diff"
      >
        <BeforeAfterDiff after={finding.after} before={finding.before} />
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            type="button"
          >
            <CheckCircle2 className="h-4 w-4" />
            수정안 확인
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-400"
            type="button"
          >
            <ExternalLink className="h-4 w-4" />
            관련 문서 열기
          </button>
        </div>
      </SectionPanel>
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
