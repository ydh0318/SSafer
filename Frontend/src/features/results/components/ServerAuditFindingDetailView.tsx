import { AlertTriangle, FileStack, ServerCog, TerminalSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

import PixelGoose from '../../../components/common/PixelGoose';
import SectionPanel from '../../../components/common/SectionPanel';
import { ROUTES } from '../../../constants/routes';
import type { ServerAuditFindingViewModel } from '../../../types/scan';

type ServerAuditFindingDetailViewProps = {
  scanId: string;
  finding: ServerAuditFindingViewModel;
  relatedFindings: ServerAuditFindingViewModel[];
  routeState: { projectId?: string };
};

function ServerAuditFindingDetailView({
  scanId,
  finding,
  relatedFindings,
  routeState,
}: ServerAuditFindingDetailViewProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div className="border border-neutral-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-bold text-neutral-700">
                {finding.severity}
              </span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-bold text-neutral-700">
                {finding.category}
              </span>
              <span className="font-mono text-xs text-neutral-500">findingId #{finding.findingId}</span>
            </div>
            <span className="font-mono text-xs text-neutral-500">{finding.target}</span>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-black">{finding.title}</h1>
          <p className="mt-4 text-sm leading-8 text-neutral-700">{finding.summary}</p>
          {finding.evidence ? <div className="mt-4 font-mono text-xs text-neutral-500">evidence: {finding.evidence}</div> : null}
        </div>

        <SectionPanel
          description="server-audit finding은 코드 패치보다 운영 조치가 핵심이므로, 위험 설명과 즉시 실행 가능한 체크 포인트를 우선 보여줍니다."
          eyebrow="WHY IT MATTERS"
          title="운영 관점 설명"
        >
          <div className="space-y-4">
            <div className="border border-neutral-200 bg-white p-5">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">summary</div>
              <p className="mt-3 text-sm leading-7 text-neutral-700">{finding.summary}</p>
            </div>
            <div className="flex items-start gap-4 border border-[#FFE066] bg-[#FFF9DB] p-5">
              <PixelGoose mood="alert" size={56} />
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">operations note</div>
                <p className="mt-2 text-sm leading-7 text-neutral-800">
                  이 화면은 patch apply 대신 운영자 점검과 수동 조치 안내를 중심으로 구성됩니다. 포트 차단, 방화벽 검토,
                  서비스 재시작 여부 같은 후속 조치를 먼저 판단하세요.
                </p>
              </div>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel eyebrow="RECOMMENDATION" title="AI 조치 제안">
          <div className="space-y-3">
            {finding.actions.map((action) => (
              <article className="border border-neutral-200 bg-white p-4" key={`${action.priority}-${action.title}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-bold text-neutral-700">
                    {action.priority}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-black text-black">{action.title}</h3>
                <p className="mt-2 text-sm leading-7 text-neutral-600">{action.description}</p>
                {action.command ? (
                  <div className="mt-3 border border-neutral-200 bg-neutral-950 p-3 font-mono text-xs text-[#D4FC64]">
                    <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">
                      <TerminalSquare className="h-3.5 w-3.5" />
                      확인 명령어
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap">{action.command}</pre>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </SectionPanel>

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionPanel eyebrow="WARNINGS" title="관련 경고">
            <div className="space-y-3">
              {finding.relatedWarnings.map((warning) => (
                <article className="border border-neutral-200 bg-white p-4" key={warning.code}>
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">
                    <AlertTriangle className="h-4 w-4" />
                    {warning.code}
                  </div>
                  <h3 className="mt-3 text-base font-black text-black">{warning.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-neutral-600">{warning.message}</p>
                </article>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel eyebrow="ARTIFACTS" title="관련 증적">
            <div className="space-y-3">
              {finding.relatedArtifacts.map((artifact) => (
                <article className="border border-neutral-200 bg-white p-4" key={`${artifact.kind}-${artifact.name}`}>
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">
                    <FileStack className="h-4 w-4" />
                    {artifact.kind}
                  </div>
                  <h3 className="mt-3 text-base font-black text-black">{artifact.name}</h3>
                  <p className="mt-2 text-sm leading-7 text-neutral-600">{artifact.description}</p>
                  {artifact.value ? (
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap border border-neutral-200 bg-[#fafafa] p-3 font-mono text-xs text-neutral-700">
                      {artifact.value}
                    </pre>
                  ) : null}
                </article>
              ))}
            </div>
          </SectionPanel>
        </div>
      </div>

      <aside className="sticky top-24 h-fit border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-bold">
            <ServerCog className="h-4 w-4" />
            다른 점검 항목
          </span>
          <span className="text-xs text-neutral-400">{relatedFindings.length}건</span>
        </div>
        <div>
          {relatedFindings.map((item) => {
            const active = item.findingId === finding.findingId;

            return (
              <Link
                className={`block border-b border-neutral-100 p-3 last:border-b-0 hover:bg-[#F5F5F5] ${
                  active ? 'border-l-2 border-l-black bg-[#F5F5F5]' : ''
                }`}
                key={item.findingId}
                state={routeState}
                to={ROUTES.resultFindingDetail.replace(':scanId', String(scanId)).replace(':findingId', String(item.findingId))}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-neutral-500">#{item.findingId}</span>
                  <span className="ml-auto text-[9px] tracking-[0.18em] text-neutral-400">{item.severity}</span>
                </div>
                <div className="mt-1 text-sm font-medium text-black">{item.title}</div>
              </Link>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

export default ServerAuditFindingDetailView;
