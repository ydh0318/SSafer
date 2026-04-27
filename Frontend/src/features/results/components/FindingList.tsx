import { ChevronRight } from 'lucide-react';

import { SeverityBadge, StatusPill } from '../../../components/common/Badge';
import { type FindingMock, formatFindingLocation } from '../../../mocks/ssaferMockData';

type FindingListProps = {
  findings: FindingMock[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
};

function FindingList({ findings, selectedId, onSelect, onOpen }: FindingListProps) {
  return (
    <div className="space-y-3">
      {findings.map((finding) => (
        <article
          key={finding.id}
          className={`rounded-lg border p-4 transition ${
            selectedId === finding.id ? 'border-slate-950 bg-slate-50' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <button className="flex-1 text-left" onClick={() => onSelect(finding.id)} type="button">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge value={finding.severity} />
                  <StatusPill value={finding.status} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{finding.ruleId}</span>
                </div>
                <p className="mt-3 text-lg font-black text-slate-950">{finding.title}</p>
                <p className="mt-1 font-mono text-sm leading-6 text-slate-500">
                  {formatFindingLocation(finding)} · {finding.evidence}
                </p>
              </div>
            </button>
            <button
              className="inline-flex items-center justify-center gap-1 rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              onClick={() => onOpen(finding.id)}
              type="button"
            >
              상세
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export default FindingList;
