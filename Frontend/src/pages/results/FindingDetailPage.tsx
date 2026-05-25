import { AlertTriangle, ArrowLeft, BookOpen, Copy, ExternalLink, Send, Trophy, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import InlineMessage from '../../components/common/InlineMessage';
import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import TypingBox from '../../components/common/TypingBox';
import { ROUTES } from '../../constants/routes';
import { useToast } from '../../features/feedback/useToast';
import useFindingDetailData from '../../features/results/hooks/useFindingDetailData';
import {
  findingResolutionMeta,
  findingResolutionValues,
  findingSeverityMeta,
  prettyJsonText,
} from '../../features/results/utils/findingDetailPresentation';
import PatchAvailabilityBadge from '../../features/scans/components/PatchAvailabilityBadge';
import ScanModeBadge from '../../features/scans/components/ScanModeBadge';
import type { FindingResolutionStatus } from '../../types/scan';

type FindingRouteState = {
  projectId?: string;
  initialView?: 'explain' | 'fix' | 'apply' | 'references';
};

function ParsedTextList({ text, fallback }: { text: string | null | undefined; fallback: string }) {
  if (!text || !text.trim()) {
    return <p className="mt-3 leading-8 text-neutral-800">{fallback}</p>;
  }

  if (!/#\d+/.test(text)) {
    return <p className="mt-3 leading-8 text-neutral-800">{text}</p>;
  }

  const parts = text.split(/(?=#\d+\.?\s*)/).filter((value) => value.trim().length > 0);

  return (
    <div className="mt-4 space-y-4">
      {parts.map((part, index) => {
        const match = part.match(/^#(\d+)\.?\s*(.*)/s);
        if (match) {
          const num = match[1];
          const content = match[2].trim();
          return (
            <div className="flex items-start gap-3" key={index}>
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                {num}
              </span>
              <p className="leading-7 text-neutral-800">{content}</p>
            </div>
          );
        }

        return (
          <p className="leading-7 text-neutral-800" key={index}>
            {part.trim()}
          </p>
        );
      })}
    </div>
  );
}

function FindingDetailPage() {
  const { scanId = '', findingId = '' } = useParams<{ scanId: string; findingId: string }>();
  const location = useLocation();
  const routeState = (location.state ?? {}) as FindingRouteState;
  const toast = useToast();
  const [view, setView] = useState<'explain' | 'fix' | 'apply' | 'references'>(
    routeState.initialView ?? 'explain',
  );

  const {
    approveErrorMessage,
    errorMessage,
    finding,
    handleApprovePatch,
    handleResolutionStatusChange,
    hasPatches,
    isApprovingPatch,
    isLoading,
    isPollingPatch,
    isUpdatingResolutionStatus,
    practiceSnippet,
    rawSnippetText,
    relatedFindingGroups,
    relatedFindings,
    scanBasic,
  } = useFindingDetailData(scanId, findingId);

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage, { durationMs: 2000 });
    } catch {
      toast.error('Failed to copy text.', { durationMs: 2000 });
    }
  };

  return (
    <section className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-black"
        state={routeState}
        to={ROUTES.resultDetail.replace(':scanId', scanId)}
      >
        <ArrowLeft className="h-4 w-4" />
        결과로 돌아가기
      </Link>

      {errorMessage ? <PageBanner message={errorMessage} tone="error" /> : null}

      {isLoading ? (
        <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">
          취약점 상세 정보를 불러오는 중입니다...
        </div>
      ) : null}

      {!isLoading && finding ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div
              className="border border-neutral-100 bg-white p-6"
              style={{ borderLeftColor: findingSeverityMeta[finding.severity].bg, borderLeftWidth: '4px' }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded px-2.5 py-1 text-[11px] font-bold tracking-[0.2em]"
                    style={{
                      background: findingSeverityMeta[finding.severity].bg,
                      color: findingSeverityMeta[finding.severity].fg,
                    }}
                  >
                    {finding.severity}
                  </span>
                  <span className="font-mono text-xs text-neutral-400">#{finding.findingId}</span>
                  {(finding.ruleId || finding.ruleCode) && (
                    <span className="font-mono text-xs text-neutral-400">{finding.ruleId || finding.ruleCode}</span>
                  )}
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    {finding.source || finding.sourceType}
                  </span>
                  {finding.category && finding.category !== (finding.source || finding.sourceType) ? (
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{finding.category}</span>
                  ) : null}
                  {scanBasic?.scanMode ? <ScanModeBadge scanMode={scanBasic.scanMode} source={scanBasic.source} /> : null}
                  <PatchAvailabilityBadge hasPatches={hasPatches} scanMode={scanBasic?.scanMode} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const meta = findingResolutionMeta[finding.resolutionStatus] ?? findingResolutionMeta.OPEN;
                    return (
                      <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-bold ${meta.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    );
                  })()}
                  <select
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs font-bold text-neutral-700 disabled:cursor-wait disabled:opacity-50"
                    disabled={isUpdatingResolutionStatus}
                    onChange={(event) => {
                      void handleResolutionStatusChange(event.target.value as FindingResolutionStatus);
                    }}
                    value={finding.resolutionStatus}
                  >
                    {findingResolutionValues.map((value) => (
                      <option key={value} value={value}>
                        {findingResolutionMeta[value].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight">{finding.title}</h1>
              <div className="mt-3 flex flex-col gap-2 text-sm text-neutral-500">
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5">
                    {finding.file || finding.resourceName || finding.filePath || '알 수 없는 대상'}
                    {(finding.line || finding.lineNumber) ? ` : ${finding.line || finding.lineNumber}` : ''}
                  </span>
                  <span className="text-neutral-300">·</span>
                  <span className="text-neutral-400">scan #{scanId}</span>
                </div>
                {finding.maskedEvidence ? (
                  <div className="mt-1 w-fit rounded border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700">
                    <span className="mr-2 font-bold text-neutral-400">근거</span>
                    {finding.maskedEvidence}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex border-b border-neutral-300">
              {[
                { id: 'explain', icon: AlertTriangle, label: '설명' },
                { id: 'fix', icon: Wand2, label: '조치 가이드' },
                { id: 'apply', icon: Send, label: '적용' },
                { id: 'references', icon: BookOpen, label: '참고 자료' },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    className={`-mb-px flex items-center gap-2 border-b-2 px-5 py-3 ${
                      view === tab.id ? 'border-black font-bold' : 'border-transparent text-neutral-500 hover:text-black'
                    }`}
                    key={tab.id}
                    onClick={() => setView(tab.id as typeof view)}
                    type="button"
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {view === 'explain' ? (
              <div className="mt-6 space-y-6">
                {finding.impact?.trim() ? (
                  <div className="flex items-start gap-4 border border-[#FFE066] bg-[#FFF9DB] p-6">
                    <PixelGoose mood="alert" size={60} />
                    <div>
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">
                        영향
                      </div>
                      <p className="mt-2 text-sm leading-7 text-neutral-800">{finding.impact}</p>
                    </div>
                  </div>
                ) : null}

                <DetailCard title="요약">
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.explanation?.summary || finding.description || '요약 정보가 없습니다.'}
                  </p>
                </DetailCard>

                <DetailCard title="위험한 이유">
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.explanation?.whyRisky || '위험 설명이 없습니다.'}
                  </p>
                </DetailCard>

                <DetailCard title="공격 시나리오">
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.explanation?.abuseScenario || finding.attackScenario || '공격 시나리오 정보가 없습니다.'}
                  </p>
                </DetailCard>

                <DetailCard title="심각도 해석">
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.explanation?.severityInterpretation || '심각도 해석 정보가 없습니다.'}
                  </p>
                </DetailCard>
              </div>
            ) : null}

            {view === 'fix' ? (
              <div className="mt-6 space-y-6">
                <DetailCard title="조치 요약">
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.fix?.summary || '조치 요약 정보가 없습니다.'}
                  </p>
                </DetailCard>

                <DetailCard title="권장 조치">
                  <ParsedTextList
                    fallback="권장 조치가 없습니다."
                    text={finding.fix?.recommendedActions?.join('\n') ?? finding.remediationGuide}
                  />
                </DetailCard>

                <DetailCard title="코드 가이드">
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.fix?.codeGuidance || '코드 가이드가 없습니다.'}
                  </p>
                </DetailCard>

                <DetailCard title="검증 방법">
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.fix?.verification || '검증 정보가 없습니다.'}
                  </p>
                </DetailCard>

                {practiceSnippet ? (
                  <div className="border border-neutral-100 bg-white p-6">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-[#e8c84f]" />
                      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">
                        연습
                      </span>
                    </div>
                    <div className="mt-4">
                      <TypingBox snippet={practiceSnippet} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {view === 'apply' ? (
              <div className="mt-6 space-y-6">
                {finding.fix?.patches && finding.fix.patches.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-xl font-black tracking-tight">적용 가능한 패치</h3>
                      {scanBasic?.scanMode === 'AGENT' && finding.resolutionStatus === 'OPEN' && finding.patchPayloadJson ? (
                        <button
                          className="inline-flex items-center justify-center gap-2 bg-[#D4FC64] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-[#c5e35b] disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={isApprovingPatch}
                          onClick={() => {
                            void handleApprovePatch();
                          }}
                          type="button"
                        >
                          <Send className="h-4 w-4" />
                          {isApprovingPatch ? '요청 중...' : '패치 적용 요청'}
                        </button>
                      ) : (
                        (() => {
                          const meta = findingResolutionMeta[finding.resolutionStatus] ?? findingResolutionMeta.OPEN;
                          return (
                            <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-bold ${meta.cls}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                              {isPollingPatch ? <span className="ml-1 animate-pulse">...</span> : null}
                            </span>
                          );
                        })()
                      )}
                    </div>

                    {approveErrorMessage ? <InlineMessage message={approveErrorMessage} tone="error" /> : null}

                    {finding.fix.patches.map((patch) => (
                      <div className="overflow-hidden border border-neutral-200 bg-white" key={patch.patchId}>
                        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-100 px-4 py-3">
                          <div className="font-mono text-sm font-bold">{patch.filePath}</div>
                          <span className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-bold tracking-[0.1em] text-neutral-700">
                            {patch.operation === 'replace' ? 'REPLACE' : 'APPEND'}
                          </span>
                        </div>
                        {patch.operation === 'replace' ? (
                          <div className="grid grid-cols-1 divide-y divide-neutral-200 font-mono text-sm md:grid-cols-2 md:divide-x md:divide-y-0">
                            <div className="whitespace-pre-wrap bg-rose-50 p-4 text-rose-900">
                              <div className="mb-2 text-xs font-bold text-rose-500">변경 전</div>
                              {patch.oldText || <span className="italic text-rose-400">(이전 텍스트 없음)</span>}
                            </div>
                            <div className="whitespace-pre-wrap bg-emerald-50 p-4 text-emerald-900">
                              <div className="mb-2 text-xs font-bold text-emerald-500">변경 후</div>
                              {patch.newText || <span className="italic text-emerald-400">(새 텍스트 없음)</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap bg-emerald-50 p-4 font-mono text-sm text-emerald-900">
                            <div className="mb-2 text-xs font-bold text-emerald-500">추가</div>
                            {patch.newText || <span className="italic text-emerald-400">(추가 텍스트 없음)</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-6 py-8 text-center text-sm text-neutral-500">
                    이 취약점에는 적용 가능한 패치 정보가 없습니다.
                  </div>
                )}

                <DetailCard title="패치 결과">
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.patchResultMessage || '아직 패치 결과가 없습니다.'}
                  </p>
                </DetailCard>

                {finding.backupMetadataJson ? (
                  <div className="bg-black p-6 text-white">
                    <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#3DDC84]">백업 메타데이터</div>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap bg-neutral-900 p-4 font-mono text-sm">
                      {prettyJsonText(finding.backupMetadataJson)}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}

            {view === 'references' ? (
              <div className="mt-6 space-y-4">
                <div className="border border-neutral-100 bg-white p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">
                        원본 스니펫
                      </div>
                      <p className="mt-2 text-sm text-neutral-500">이 취약점 분석에 사용된 스니펫과 구조화된 컨텍스트입니다.</p>
                    </div>
                    <button
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:border-black hover:text-black"
                      onClick={() => void copyText(rawSnippetText, '원본 스니펫을 복사했습니다.')}
                      type="button"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      복사
                    </button>
                  </div>
                  <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-lg bg-neutral-950 px-5 py-4 font-mono text-sm leading-7 text-[#D4FC64]">
                    {rawSnippetText}
                  </pre>
                </div>

                {finding.references && finding.references.length > 0 ? (
                  <>
                    {finding.references.map((reference, index) => (
                      <a
                        className="block border border-neutral-200 bg-white p-5 transition hover:border-neutral-400 hover:shadow-sm"
                        href={reference.url}
                        key={index}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold leading-6 text-black">{reference.title}</h4>
                            {reference.snippet ? (
                              <p className="mt-2 text-sm leading-6 text-neutral-600">{reference.snippet}</p>
                            ) : null}
                            <span className="mt-2 inline-block truncate font-mono text-xs text-neutral-400">
                              {reference.url}
                            </span>
                          </div>
                          <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-neutral-300" />
                        </div>
                      </a>
                    ))}
                  </>
                ) : (
                  <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-6 py-8 text-center text-sm text-neutral-500">
                    참고 링크가 없습니다.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <aside className="sticky top-24 h-fit border border-neutral-100 bg-white">
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400">관련 취약점</p>
              <p className="mt-0.5 text-lg font-black text-black">
                {relatedFindings.length}
                <span className="ml-1 text-sm font-normal text-neutral-400">건</span>
              </p>
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              {relatedFindingGroups.map((group) => (
                <div className="border-b border-neutral-100 last:border-b-0" key={group.severity}>
                  <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: findingSeverityMeta[group.severity].bg, color: findingSeverityMeta[group.severity].fg }}
                    >
                      {group.severity}
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400">{group.items.length}</span>
                  </div>
                  {group.items.map((item) => {
                    const active = item.findingId === finding.findingId;
                    const dimmed = item.resolutionStatus === 'RESOLVED' || item.resolutionStatus === 'IGNORED';
                    const meta = findingResolutionMeta[item.resolutionStatus] ?? findingResolutionMeta.OPEN;

                    return (
                      <Link
                        className={`group relative flex items-stretch gap-0 border-b border-neutral-100 last:border-b-0 transition-colors ${
                          active ? 'bg-[#F4FFD9]' : dimmed ? 'bg-neutral-50 hover:bg-neutral-100' : 'hover:bg-[#FAFAF7]'
                        }`}
                        key={item.findingId}
                        state={{ ...routeState, initialView: 'explain' }}
                        to={ROUTES.resultFindingDetail
                          .replace(':scanId', String(item.scanId))
                          .replace(':findingId', String(item.findingId))}
                      >
                        <div
                          className="w-1 shrink-0"
                          style={{ background: active ? '#9FCC2E' : findingSeverityMeta[item.severity].bg }}
                        />
                        <div className={`min-w-0 flex-1 px-3 py-3 ${dimmed ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-neutral-400">#{item.findingId}</span>
                            <span className={`ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${meta.cls}`}>
                              <span className={`h-1 w-1 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                          </div>
                          <p
                            className={`mt-1.5 line-clamp-2 text-xs font-medium leading-snug ${
                              active ? 'text-black' : dimmed ? 'text-neutral-400 line-through' : 'text-neutral-700 group-hover:text-black'
                            }`}
                          >
                            {item.title}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-100 px-4 py-2.5 font-mono text-[10px] text-neutral-400">
              scan #{scanId}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function DetailCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="border border-neutral-100 bg-white p-6">
      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">
        {title}
      </div>
      {children}
    </div>
  );
}

export default FindingDetailPage;
