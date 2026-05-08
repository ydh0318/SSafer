import { AlertTriangle, FileStack, ShieldAlert, TerminalSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

import MetricCard from '../../../components/common/MetricCard';
import SectionPanel from '../../../components/common/SectionPanel';
import { ROUTES } from '../../../constants/routes';
import ScanTypeBadge from '../../scans/components/ScanTypeBadge';
import { formatDateTime } from '../../scans/utils/scanPresentation';
import type { ServerAuditResultViewModel } from '../../../types/scan';

type ServerAuditResultViewProps = {
  result: ServerAuditResultViewModel;
  routeState: { projectId?: string };
};

function getPriorityTone(priority: ServerAuditResultViewModel['actions'][number]['priority']) {
  switch (priority) {
    case 'IMMEDIATE':
      return 'red';
    case 'HIGH':
      return 'orange';
    case 'MEDIUM':
      return 'amber';
    default:
      return 'plain';
  }
}

function ServerAuditResultView({ result, routeState }: ServerAuditResultViewProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard helper="즉시 확인이 필요한 서버 점검 finding 수" label="Findings" tone="red" value={result.findings.length} />
        <MetricCard helper="운영 시 주의가 필요한 warning 수" label="Warnings" tone="amber" value={result.warnings.length} />
        <MetricCard helper="수집된 런타임 증적 수" label="Artifacts" tone="sky" value={result.artifacts.length} />
        <MetricCard helper="AI가 정리한 운영 조치 제안 수" label="AI Actions" tone="green" value={result.actions.length} />
      </div>

      <SectionPanel
        description="server-audit는 코드 패치 결과 화면이 아니라 운영 보안 점검 결과 화면입니다. 노출 포트, 컨테이너 권한, 방화벽 상태 같은 런타임 증적과 조치 제안을 함께 확인합니다."
        eyebrow="SERVER AUDIT"
        title="운영 보안 점검 개요"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="border border-neutral-200 bg-[#fafafa] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">scan type</div>
            <div className="mt-3">
              <ScanTypeBadge scanType={result.scanType} />
            </div>
          </div>
          <div className="border border-neutral-200 bg-[#fafafa] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">target</div>
            <div className="mt-3 text-lg font-black text-black">{result.targetLabel}</div>
            <div className="mt-1 text-sm text-neutral-500">{result.hostLabel}</div>
          </div>
          <div className="border border-neutral-200 bg-[#fafafa] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">generated at</div>
            <div className="mt-3 text-lg font-black text-black">{formatDateTime(result.generatedAt)}</div>
            <div className="mt-1 text-sm text-neutral-500">scanId #{result.scanId}</div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        description="서버 내부에서 실제 관찰된 위험 요소입니다. 각 항목은 운영 조치 중심으로 읽을 수 있게 구성합니다."
        eyebrow="FINDINGS"
        title="주요 점검 결과"
      >
        <div className="space-y-3">
          {result.findings.map((finding) => (
            <Link
              className="group flex items-start gap-4 border border-neutral-200 bg-white p-5 transition hover:border-black hover:bg-[#fafafa]"
              key={finding.findingId}
              state={routeState}
              to={ROUTES.resultFindingDetail
                .replace(':scanId', String(result.scanId))
                .replace(':findingId', String(finding.findingId))}
            >
              <div className="flex h-10 w-10 items-center justify-center bg-black text-white">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-bold text-neutral-700">
                    {finding.severity}
                  </span>
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-bold text-neutral-700">
                    {finding.category}
                  </span>
                  <span className="font-mono text-xs text-neutral-500">#{finding.findingId}</span>
                  <span className="ml-auto font-mono text-xs text-neutral-500">{finding.target}</span>
                </div>
                <h3 className="mt-3 text-lg font-black text-black">{finding.title}</h3>
                <p className="mt-2 text-sm leading-7 text-neutral-600">{finding.summary}</p>
                <p className="mt-2 text-xs font-mono text-neutral-500">{finding.evidence ?? '증적 요약 정보 없음'}</p>
              </div>
              <span className="inline-flex items-center gap-2 bg-black px-3 py-2 text-xs font-bold text-white transition group-hover:bg-[#D4FC64] group-hover:text-black">
                상세 보기
              </span>
            </Link>
          ))}
        </div>
      </SectionPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionPanel
          description="AI 조치 제안은 운영자가 바로 확인하고 우선순위를 매길 수 있게 명령어와 영향 범위를 함께 정리합니다."
          eyebrow="AI ACTIONS"
          title="운영 조치 제안"
        >
          <div className="space-y-3">
            {result.actions.map((action) => (
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
                {action.impact ? <p className="mt-3 text-xs text-neutral-500">영향 범위: {action.impact}</p> : null}
              </article>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel
          description="warning과 artifact는 서버 상태를 설명하는 보조 근거입니다. 패치 버튼 대신 운영 확인 포인트를 빠르게 읽는 용도로 배치합니다."
          eyebrow="RUNTIME EVIDENCE"
          title="Warnings & Artifacts"
        >
          <div className="space-y-5">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">
                <AlertTriangle className="h-4 w-4" />
                warnings
              </div>
              <div className="space-y-3">
                {result.warnings.map((warning) => (
                  <article className="border border-neutral-200 bg-white p-4" key={warning.code}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-bold text-neutral-700">
                        {warning.severity}
                      </span>
                      <span className="font-mono text-xs text-neutral-500">{warning.code}</span>
                    </div>
                    <h3 className="mt-3 text-base font-black text-black">{warning.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-neutral-600">{warning.message}</p>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">
                <FileStack className="h-4 w-4" />
                artifacts
              </div>
              <div className="space-y-3">
                {result.artifacts.map((artifact) => (
                  <article className="border border-neutral-200 bg-white p-4" key={`${artifact.kind}-${artifact.name}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-bold text-neutral-700">
                        {artifact.kind}
                      </span>
                      <span className="font-mono text-xs text-neutral-500">{artifact.name}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-neutral-600">{artifact.description}</p>
                    {artifact.value ? (
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap border border-neutral-200 bg-[#fafafa] p-3 font-mono text-xs text-neutral-700">
                        {artifact.value}
                      </pre>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}

export default ServerAuditResultView;
