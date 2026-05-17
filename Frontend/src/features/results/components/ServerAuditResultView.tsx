import { AlertTriangle, FileStack, ShieldAlert, TerminalSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

import SectionPanel from '../../../components/common/SectionPanel';
import { ROUTES } from '../../../constants/routes';
import ScanTypeBadge from '../../scans/components/ScanTypeBadge';
import { formatDateTime } from '../../scans/utils/scanPresentation';
import type { ServerAuditResultViewModel } from '../../../types/scan';

type ServerAuditResultViewProps = {
  result: ServerAuditResultViewModel;
  routeState: { projectId?: string };
};

// PROJECT_FILE 결과 페이지의 Severity 카드와 동일한 톤 (좌측 컬러 보더 + 흰 배경)
type AuditMetricTone = {
  label: string;
  accent: string; // 좌측 보더 + 라벨 컬러
  helper: string;
};

function AuditMetricCard({ tone, value }: { tone: AuditMetricTone; value: number }) {
  return (
    <div
      className="border border-neutral-100 bg-white px-5 py-4"
      style={{ borderLeftColor: tone.accent, borderLeftWidth: '3px' }}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: tone.accent }}>
        {tone.label}
      </span>
      <div className={`mt-2 text-4xl font-black ${value === 0 ? 'text-neutral-200' : 'text-black'}`}>{value}</div>
      <p className="mt-2 text-xs leading-6 text-neutral-500">{tone.helper}</p>
    </div>
  );
}

const findingsTone: AuditMetricTone = { label: 'FINDINGS', accent: '#E63946', helper: '즉시 확인이 필요한 서버 점검 finding 수' };
const warningsTone: AuditMetricTone = { label: 'WARNINGS', accent: '#F59E0B', helper: '운영 시 주의가 필요한 warning 수' };
const artifactsTone: AuditMetricTone = { label: 'ARTIFACTS', accent: '#0EA5E9', helper: '수집된 런타임 증적 수' };
const actionsTone: AuditMetricTone = { label: 'AI ACTIONS', accent: '#10B981', helper: 'AI가 정리한 운영 조치 제안 수' };

function ServerAuditResultView({ result, routeState }: ServerAuditResultViewProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AuditMetricCard tone={findingsTone} value={result.findings.length} />
        {result.warnings.length > 0 && <AuditMetricCard tone={warningsTone} value={result.warnings.length} />}
        {result.artifacts.length > 0 && <AuditMetricCard tone={artifactsTone} value={result.artifacts.length} />}
        {result.actions.length > 0 && <AuditMetricCard tone={actionsTone} value={result.actions.length} />}
      </div>

      <SectionPanel
        description="server-audit는 코드 패치 결과 화면이 아니라 운영 보안 점검 결과 화면입니다. 각 항목은 Agent가 점검한 서버에서 수집된 실제 결과입니다."
        eyebrow="SERVER AUDIT"
        title="운영 보안 점검 개요"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="border border-neutral-100 bg-white px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">scan type</div>
            <div className="mt-3">
              <ScanTypeBadge scanType={result.scanType} />
            </div>
          </div>
          <div className="border border-neutral-100 bg-white px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">target</div>
            <div className="mt-3 text-lg font-black text-black">{result.targetLabel}</div>
            <div className="mt-1 text-sm text-neutral-500">{result.hostLabel}</div>
          </div>
          <div className="border border-neutral-100 bg-white px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">generated at</div>
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
              className="group flex items-start gap-4 border border-neutral-100 bg-white px-5 py-4 transition hover:border-black"
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
                {finding.recommendation ? (
                  <p className="mt-2 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-6 text-neutral-700">
                    <span className="mr-1.5 font-bold uppercase tracking-[0.16em] text-neutral-400">권고</span>
                    {finding.recommendation}
                  </p>
                ) : null}
              </div>
              <span className="inline-flex items-center gap-2 bg-black px-3 py-2 text-xs font-bold text-white transition group-hover:bg-[#D4FC64] group-hover:text-black">
                상세 보기
              </span>
            </Link>
          ))}
        </div>
      </SectionPanel>

      {result.actions.length === 0 && result.warnings.length === 0 && result.artifacts.length === 0 && (
        <div className="rounded border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm text-neutral-500">
          <span className="mr-2 font-bold uppercase tracking-[0.16em]">참고</span>
          Warnings · Artifacts · AI Actions 항목은 백엔드 server-audit 전용 API가 지원되면 표시됩니다. 현재 버전에서는 해당 데이터를 제공하지 않습니다.
        </div>
      )}

      {(result.actions.length > 0 || result.warnings.length > 0 || result.artifacts.length > 0) && (
        <div className="grid gap-6 xl:grid-cols-2">
          {result.actions.length > 0 && (
            <SectionPanel
              description="AI 조치 제안은 운영자가 바로 확인하고 우선순위를 매길 수 있게 명령어와 영향 범위를 함께 정리합니다."
              eyebrow="AI ACTIONS"
              title="운영 조치 제안"
            >
              <div className="space-y-3">
                {result.actions.map((action) => (
                  <article className="border border-neutral-100 bg-white px-5 py-4" key={`${action.priority}-${action.title}`}>
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
          )}

          {(result.warnings.length > 0 || result.artifacts.length > 0) && (
            <SectionPanel
              description="warning과 artifact는 서버 상태를 설명하는 보조 근거입니다."
              eyebrow="RUNTIME EVIDENCE"
              title="Warnings & Artifacts"
            >
              <div className="space-y-5">
                {result.warnings.length > 0 && (
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">
                      <AlertTriangle className="h-4 w-4" />
                      warnings
                    </div>
                    <div className="space-y-3">
                      {result.warnings.map((warning) => (
                        <article className="border border-neutral-100 bg-white px-5 py-4" key={warning.code}>
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
                )}

                {result.artifacts.length > 0 && (
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">
                      <FileStack className="h-4 w-4" />
                      artifacts
                    </div>
                    <div className="space-y-3">
                      {result.artifacts.map((artifact) => (
                        <article className="border border-neutral-100 bg-white px-5 py-4" key={`${artifact.kind}-${artifact.name}`}>
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
                )}
              </div>
            </SectionPanel>
          )}
        </div>
      )}
    </div>
  );
}

export default ServerAuditResultView;
