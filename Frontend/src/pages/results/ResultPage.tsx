import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { SeverityBadge, StatusPill } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';
import FindingList from '../../features/results/components/FindingList';
import FindingSummary from '../../features/results/components/FindingSummary';
import { findings, formatFindingLocation } from '../../mocks/ssaferMockData';

function ResultPage() {
  const { scanId = 'scan-a36' } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'list' | 'node'>('list');
  const [selectedId, setSelectedId] = useState(findings[0].id);
  const selected = findings.find((item) => item.id === selectedId) ?? findings[0];

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <FindingSummary findings={findings} />

        <SectionPanel
          action={
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button className={tabClass(mode === 'list')} onClick={() => setMode('list')} type="button">
                List
              </button>
              <button className={tabClass(mode === 'node')} onClick={() => setMode('node')} type="button">
                Node
              </button>
            </div>
          }
          description={`${scanId} 결과의 기본 조회, 요약 조회, Finding 리스트, 노드 기준 조회가 한 화면에서 분기됩니다.`}
          eyebrow="Result workbench"
          title="결과 워크벤치"
        >
          <FilterBar />
          {mode === 'node' ? (
            <NodeGraph onSelect={setSelectedId} selectedId={selectedId} />
          ) : (
            <FindingList
              findings={findings}
              onOpen={(findingId) => {
                navigate(ROUTES.findingDetail.replace(':scanId', scanId).replace(':findingId', findingId));
              }}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
          )}
        </SectionPanel>
      </div>

      <div className="space-y-6">
        <SelectedFinding findingId={selected.id} scanId={scanId} />
        <ApiEndpointList compact screenId="result" />
      </div>
    </div>
  );
}

function tabClass(active: boolean) {
  return `rounded-md px-3 py-2 text-sm font-bold transition ${active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-white'}`;
}

function FilterBar() {
  return (
    <div className="mb-5 flex flex-wrap gap-2 rounded-lg bg-slate-50 p-3">
      <SeverityBadge value="CRITICAL" />
      <SeverityBadge value="HIGH" />
      <SeverityBadge value="MEDIUM" />
      <SeverityBadge value="LOW" />
      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">category=secret</span>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">status=OPEN</span>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">page=1&size=20</span>
    </div>
  );
}

function NodeGraph({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const nodes = [
    { id: 'FND-0001', x: '18%', y: '28%', label: '.env', sev: 'CRITICAL' as const },
    { id: 'FND-0002', x: '43%', y: '42%', label: 'Dockerfile', sev: 'HIGH' as const },
    { id: 'FND-0003', x: '62%', y: '24%', label: 'compose', sev: 'MEDIUM' as const },
    { id: 'FND-0004', x: '76%', y: '60%', label: 'health', sev: 'LOW' as const },
  ];

  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-lg border border-slate-200 bg-white p-5">
      <svg className="absolute inset-0 h-full w-full text-slate-300" role="presentation">
        <line stroke="currentColor" strokeWidth="2" x1="18%" x2="43%" y1="28%" y2="42%" />
        <line stroke="currentColor" strokeWidth="2" x1="43%" x2="62%" y1="42%" y2="24%" />
        <line stroke="currentColor" strokeWidth="2" x1="43%" x2="76%" y1="42%" y2="60%" />
      </svg>
      {nodes.map((node) => (
        <button
          className={`absolute grid h-24 w-32 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg border-2 bg-white p-3 text-center shadow-sm transition hover:scale-105 ${
            selectedId === node.id ? 'border-slate-950' : 'border-slate-200'
          }`}
          key={node.id}
          onClick={() => onSelect(node.id)}
          style={{ left: node.x, top: node.y }}
          type="button"
        >
          <SeverityBadge value={node.sev} />
          <p className="mt-2 text-xs font-black text-slate-700">{node.label}</p>
        </button>
      ))}
    </div>
  );
}

function SelectedFinding({ findingId, scanId }: { findingId: string; scanId: string }) {
  const finding = findings.find((item) => item.id === findingId) ?? findings[0];

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Selected Finding</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <SeverityBadge value={finding.severity} />
        <StatusPill value={finding.status} />
      </div>
      <h3 className="mt-4 text-xl font-black leading-tight text-slate-950">{finding.title}</h3>
      <p className="mt-3 rounded-lg bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-700">{finding.evidence}</p>
      <div className="mt-4 space-y-3 text-sm text-slate-600">
        <p>
          <b>위치</b> · {formatFindingLocation(finding)}
        </p>
        <p>
          <b>노드</b> · {finding.nodeId}
        </p>
      </div>
      <Link
        className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
        to={ROUTES.findingDetail.replace(':scanId', scanId).replace(':findingId', finding.id)}
      >
        Finding 상세 열기
      </Link>
    </aside>
  );
}

export default ResultPage;
