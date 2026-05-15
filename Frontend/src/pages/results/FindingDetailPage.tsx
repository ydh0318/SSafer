import { AlertTriangle, ArrowLeft, Copy, Send, Trophy, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import InlineMessage from '../../components/common/InlineMessage';
import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import TypingBox from '../../components/common/TypingBox';
import { ROUTES } from '../../constants/routes';
import { useToast } from '../../features/feedback/useToast';
import { getScanBasic, getScanFindingDetail, getScanFindings } from '../../features/results/api/results';
import { approveFindingPatch } from '../../features/scans/api/scans';
import PatchAvailabilityBadge from '../../features/scans/components/PatchAvailabilityBadge';
import ScanModeBadge from '../../features/scans/components/ScanModeBadge';
import { formatDateTime } from '../../features/scans/utils/scanPresentation';
import type {
  FindingSeverity,
  ScanBasicData,
  ScanFindingDetailData,
  ScanFindingListItemData,
} from '../../types/scan';

type FindingRouteState = {
  projectId?: string;
};

const severityMeta: Record<FindingSeverity, { bg: string; fg: string; soft: string }> = {
  CRITICAL: { bg: '#E63946', fg: '#FFFFFF', soft: '#FFE5E5' },
  HIGH:     { bg: '#FF8A33', fg: '#FFFFFF', soft: '#FFF1E5' },
  MEDIUM:   { bg: '#FFB627', fg: '#111111', soft: '#FFF9DB' },
  LOW:      { bg: '#3D5AFE', fg: '#FFFFFF', soft: '#E5EBFF' },
  INFO:     { bg: '#9CA3AF', fg: '#FFFFFF', soft: '#F3F4F6' },
};

const resolutionDisplayMeta: Record<string, { label: string; cls: string; dot: string }> = {
  OPEN:        { label: '미해결',   cls: 'bg-neutral-100 text-neutral-600',                         dot: 'bg-neutral-400' },
  IN_PROGRESS: { label: '처리 중',  cls: 'border border-amber-200 bg-amber-50 text-amber-700',      dot: 'bg-amber-400'   },
  RESOLVED:    { label: '해결 완료', cls: 'bg-[#EDFFC0] text-[#4A7A00]',                            dot: 'bg-[#9FCC2E]'   },
  IGNORED:     { label: '무시됨',   cls: 'bg-neutral-100 text-neutral-400',                         dot: 'bg-neutral-300' },
};

function prettyJsonText(value: string | null) {
  if (!value) {
    return '표시할 코드나 원본 정보가 없습니다.';
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function getPracticeSnippet(finding: ScanFindingDetailData | null) {
  if (!finding) {
    return '';
  }

  const preferred = [finding.remediationGuide, finding.patchResultMessage, finding.title].find((value) => Boolean(value && value.trim()));

  return preferred ?? '';
}

function ParsedTextList({ text, fallback }: { text: string | null | undefined; fallback: string }) {
  if (!text || !text.trim()) {
    return <p className="mt-3 leading-8 text-neutral-800">{fallback}</p>;
  }

  if (!/#\d+/.test(text)) {
    return <p className="mt-3 leading-8 text-neutral-800">{text}</p>;
  }

  const parts = text.split(/(?=#\d+\.?\s*)/).filter((s) => s.trim().length > 0);

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

  const [view, setView] = useState<'explain' | 'fix' | 'apply' | 'references'>('explain');
  const [scanBasic, setScanBasic] = useState<ScanBasicData | null>(null);
  const [finding, setFinding] = useState<ScanFindingDetailData | null>(null);
  const [relatedFindings, setRelatedFindings] = useState<ScanFindingListItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApprovingPatch, setIsApprovingPatch] = useState(false);
  const [approveErrorMessage, setApproveErrorMessage] = useState<string | null>(null);
  const [isPollingPatch, setIsPollingPatch] = useState(false);

  useEffect(() => {
    if (!scanId || !findingId) {
      return;
    }

    let isMounted = true;

    const loadFinding = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const basicData = await getScanBasic(scanId);

        if (!isMounted) {
          return;
        }

        setScanBasic(basicData);

        const [detailData, findingListData] = await Promise.all([
          getScanFindingDetail(scanId, findingId),
          getScanFindings(scanId, { page: 0, size: 100 }),
        ]);

        if (!isMounted) {
          return;
        }

        setFinding(detailData);
        setRelatedFindings(findingListData.items);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : '탐지 항목 상세 정보를 불러오지 못했습니다.');
        setScanBasic(null);
        setFinding(null);
        setRelatedFindings([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadFinding();

    return () => {
      isMounted = false;
    };
  }, [findingId, scanId]);

  const practiceSnippet = useMemo(() => getPracticeSnippet(finding), [finding]);
  const rawSnippetText = useMemo(() => prettyJsonText(finding?.rawSnippetJson ?? null), [finding?.rawSnippetJson]);
  const hasPatches = Boolean(finding?.fix?.patches?.length);

  useEffect(() => {
    if (!finding || finding.resolutionStatus !== 'IN_PROGRESS' || !scanId || !findingId) {
      setIsPollingPatch(false);
      return;
    }

    setIsPollingPatch(true);
    let cancelled = false;

    const poll = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      if (cancelled) {
        return;
      }

      try {
        const [refreshedFinding, refreshedFindingList] = await Promise.all([
          getScanFindingDetail(scanId, findingId),
          getScanFindings(scanId, { page: 0, size: 100 }),
        ]);

        if (!cancelled) {
          setFinding(refreshedFinding);
          setRelatedFindings(refreshedFindingList.items);
        }
      } catch {
        // 폴링 실패는 조용히 무시
      }
    };

    void poll();

    return () => {
      cancelled = true;
      setIsPollingPatch(false);
    };
  }, [finding?.resolutionStatus, scanId, findingId]);

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage, { durationMs: 2000 });
    } catch {
      toast.error('복사에 실패했습니다. 다시 시도해 주세요.', { durationMs: 2000 });
    }
  };

  const handleApprovePatch = useCallback(async () => {
    if (!scanId || !findingId || !finding) {
      return;
    }

    setApproveErrorMessage(null);
    setIsApprovingPatch(true);

    try {
      await approveFindingPatch(scanId, findingId);

      const [refreshedFinding, refreshedFindingList] = await Promise.all([
        getScanFindingDetail(scanId, findingId),
        getScanFindings(scanId, { page: 0, size: 100 }),
      ]);

      setFinding(refreshedFinding);
      setRelatedFindings(refreshedFindingList.items);
      toast.success('패치 승인이 접수되었습니다.', { durationMs: 2000 });
    } catch (error) {
      setApproveErrorMessage(error instanceof Error ? error.message : '패치 승인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsApprovingPatch(false);
    }
  }, [finding, findingId, scanId, toast]);

  return (
    <section className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-black"
        state={routeState}
        to={ROUTES.resultDetail.replace(':scanId', scanId)}
      >
        <ArrowLeft className="h-4 w-4" />
        결과 목록으로 돌아가기
      </Link>

      {errorMessage ? <PageBanner message={errorMessage} tone="error" /> : null}

      {isLoading ? (
        <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">탐지 항목 상세 정보를 불러오는 중입니다.</div>
      ) : null}

      {!isLoading && finding ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div
              className="border border-neutral-100 bg-white p-6"
              style={{ borderLeftColor: severityMeta[finding.severity].bg, borderLeftWidth: '4px' }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded px-2.5 py-1 text-[11px] font-bold tracking-[0.2em]"
                    style={{
                      background: severityMeta[finding.severity].bg,
                      color: severityMeta[finding.severity].fg,
                    }}
                  >
                    {finding.severity}
                  </span>
                  <span className="font-mono text-xs text-neutral-400">#{finding.findingId}</span>
                  {(finding.ruleId || finding.ruleCode) && (
                    <span className="font-mono text-xs text-neutral-400">{finding.ruleId || finding.ruleCode}</span>
                  )}
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{finding.source || finding.sourceType}</span>
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{finding.category}</span>
                  {scanBasic?.scanMode ? <ScanModeBadge scanMode={scanBasic.scanMode} source={scanBasic.source} /> : null}
                  <PatchAvailabilityBadge hasPatches={hasPatches} scanMode={scanBasic?.scanMode} />
                </div>
                {(() => {
                  const rm = resolutionDisplayMeta[finding.resolutionStatus] ?? resolutionDisplayMeta['OPEN'];
                  return (
                    <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-bold ${rm.cls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${rm.dot}`} />
                      {rm.label}
                    </span>
                  );
                })()}
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-tight">{finding.title}</h1>
              <div className="mt-3 flex flex-col gap-2 text-sm text-neutral-500">
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <span className="rounded bg-neutral-50 border border-neutral-200 px-2 py-0.5">
                    {finding.file || finding.resourceName || finding.filePath || '위치 불명'}
                    {(finding.line || finding.lineNumber) ? ` : ${finding.line || finding.lineNumber}` : ''}
                  </span>
                  <span className="text-neutral-300">·</span>
                  <span className="text-neutral-400">scan #{scanId}</span>
                </div>
                {finding.maskedEvidence ? (
                  <div className="mt-1 w-fit rounded border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700">
                    <span className="mr-2 font-bold text-neutral-400">Evidence</span>
                    {finding.maskedEvidence}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex border-b border-neutral-300">
              {[
                { id: 'explain', label: '왜 위험한가', icon: AlertTriangle },
                { id: 'fix', label: '어떻게 고치나', icon: Wand2 },
                { id: 'apply', label: '패치 적용', icon: Send },
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
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">현실적 영향 (IMPACT)</div>
                      <p className="mt-2 text-sm leading-7 text-neutral-800">
                        {finding.impact}
                      </p>
                    </div>
                  </div>
                ) : null}

                {finding.explanation ? (
                  <>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">취약점 요약</div>
                      <p className="mt-3 leading-8 text-neutral-800">{finding.explanation.summary || '내용이 제공되지 않았습니다.'}</p>
                    </div>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">위험한 이유</div>
                      <p className="mt-3 leading-8 text-neutral-800">{finding.explanation.whyRisky || '내용이 제공되지 않았습니다.'}</p>
                    </div>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">악용 가능 시나리오</div>
                      <p className="mt-3 leading-8 text-neutral-800">{finding.explanation.abuseScenario || '내용이 제공되지 않았습니다.'}</p>
                    </div>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">예상 영향</div>
                      <p className="mt-3 leading-8 text-neutral-800">{finding.explanation.expectedImpact || '내용이 제공되지 않았습니다.'}</p>
                    </div>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">심각도 해석</div>
                      <p className="mt-3 leading-8 text-neutral-800">{finding.explanation.severityInterpretation || '내용이 제공되지 않았습니다.'}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">WHY RISKY</div>
                      <ParsedTextList fallback="이 항목이 왜 위험한지에 대한 설명이 아직 제공되지 않았습니다." text={finding.description} />
                    </div>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">REAL WORLD IMPACT</div>
                      <ParsedTextList fallback="실제 공격 시나리오나 영향 범위 설명이 아직 제공되지 않았습니다." text={finding.attackScenario} />
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {view === 'fix' ? (
              <div className="mt-6 space-y-6">
                {finding.fix ? (
                  <>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">수정 요약</div>
                      <p className="mt-3 leading-8 text-neutral-800">{finding.fix.summary || '내용이 제공되지 않았습니다.'}</p>
                    </div>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">권장 조치</div>
                      {finding.fix.recommendedActions && finding.fix.recommendedActions.length > 0 ? (
                        <ul className="mt-3 list-disc pl-5 leading-8 text-neutral-800">
                          {finding.fix.recommendedActions.map((action, idx) => (
                            <li key={idx}>{action}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 leading-8 text-neutral-400">등록된 권장 조치가 없습니다.</p>
                      )}
                    </div>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">코드 가이드</div>
                      <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111]">
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
                            <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
                            <span className="h-2 w-2 rounded-full bg-[#28C840]" />
                            <span className="ml-2 font-mono text-[10px] text-neutral-500">code-guidance</span>
                          </div>
                          <button
                            className="inline-flex items-center gap-1 font-mono text-[10px] text-neutral-500 transition hover:text-white disabled:opacity-30"
                            disabled={!finding.fix?.codeGuidance}
                            onClick={() => void copyText(finding.fix?.codeGuidance || '', '코드 가이드가 복사되었습니다.')}
                            type="button"
                          >
                            <Copy className="h-3 w-3" />
                            복사
                          </button>
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap px-5 py-4 font-mono text-sm leading-7 text-neutral-200">
                          {finding.fix.codeGuidance || '제공된 코드 가이드가 없습니다.'}
                        </pre>
                      </div>
                    </div>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">검증 방법</div>
                      <p className="mt-3 leading-8 text-neutral-800">{finding.fix.verification || '내용이 제공되지 않았습니다.'}</p>
                    </div>
                    {finding.fix.cautions && finding.fix.cautions.length > 0 && (
                      <div className="border border-rose-200 bg-rose-50 p-6">
                        <div className="text-xs font-bold uppercase tracking-[0.24em] text-rose-700">주의사항</div>
                        <ul className="mt-3 list-disc pl-5 leading-8 text-rose-800">
                          {finding.fix.cautions.map((caution, idx) => (
                            <li key={idx}>{caution}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="border border-neutral-100 bg-white p-6">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">REMEDIATION GUIDE</div>
                      <p className="mt-3 leading-8 text-neutral-800">
                        {finding.remediationGuide || '이 항목에 대한 수정 가이드가 아직 제공되지 않았습니다.'}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#FF5F57] before:content-['']">원본 코드</div>
                        <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111]">
                          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
                              <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
                              <span className="h-2 w-2 rounded-full bg-[#28C840]" />
                              <span className="ml-2 font-mono text-[10px] text-neutral-500">raw-snippet</span>
                            </div>
                            <button
                              className="inline-flex items-center gap-1 font-mono text-[10px] text-neutral-500 transition hover:text-white"
                              onClick={() => void copyText(rawSnippetText, '원본 코드가 복사되었습니다.')}
                              type="button"
                            >
                              <Copy className="h-3 w-3" />
                              복사
                            </button>
                          </div>
                          <pre className="overflow-x-auto whitespace-pre-wrap px-5 py-4 font-mono text-sm leading-7 text-neutral-200">
                            {rawSnippetText}
                          </pre>
                        </div>
                      </div>

                      <div>
                        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">수정 제안</div>
                        <div className="mt-3 overflow-hidden rounded-lg border border-neutral-800 bg-[#111]">
                          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
                              <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
                              <span className="h-2 w-2 rounded-full bg-[#28C840]" />
                              <span className="ml-2 font-mono text-[10px] text-neutral-500">recommended-action</span>
                            </div>
                            <button
                              className="inline-flex items-center gap-1 font-mono text-[10px] text-neutral-500 transition hover:text-white disabled:opacity-30"
                              disabled={!finding.remediationGuide}
                              onClick={() => void copyText(finding.remediationGuide || '', '수정 가이드가 복사되었습니다.')}
                              type="button"
                            >
                              <Copy className="h-3 w-3" />
                              복사
                            </button>
                          </div>
                          <pre className="overflow-x-auto whitespace-pre-wrap px-5 py-4 font-mono text-sm leading-7 text-[#D4FC64]">
                            {finding.remediationGuide || '수정 가이드가 아직 없습니다.'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {practiceSnippet ? (
                  <div className="border border-neutral-100 bg-white p-6">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-[#e8c84f]" />
                      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500 before:inline-block before:h-3 before:w-0.5 before:rounded-full before:bg-[#D4FC64] before:content-['']">수정안 연습</span>
                      <span className="ml-auto text-xs text-neutral-400">클릭 후 직접 입력해보세요</span>
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
                      <h3 className="text-xl font-black tracking-tight">자동 적용 가능한 패치</h3>
                      {scanBasic?.scanMode === 'AGENT' && finding.resolutionStatus === 'OPEN' && finding.patchPayloadJson ? (
                        <button
                          className="inline-flex items-center justify-center gap-2 bg-black px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                          disabled={isApprovingPatch}
                          onClick={() => { void handleApprovePatch(); }}
                          type="button"
                        >
                          <Send className="h-4 w-4" />
                          {isApprovingPatch ? '적용 요청 중...' : '패치 적용 승인'}
                        </button>
                      ) : (
                        (() => {
                          const rm = resolutionDisplayMeta[finding.resolutionStatus] ?? resolutionDisplayMeta['OPEN'];
                          return (
                            <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-bold ${rm.cls}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${rm.dot}`} />
                              {rm.label}
                              {isPollingPatch && <span className="ml-1 animate-pulse">…</span>}
                            </span>
                          );
                        })()
                      )}
                    </div>
                    {approveErrorMessage ? <InlineMessage message={approveErrorMessage} tone="error" /> : null}
                    {finding.resolutionStatus === 'OPEN' && finding.patchPayloadJson && (
                      <p className="text-xs text-neutral-500">
                        Agent가 연결된 서버에서 아래 변경 사항을 실제 파일에 자동으로 적용합니다. 승인 전 반드시 내용을 확인하세요.
                      </p>
                    )}
                    {finding.fix.patches.map((patch) => (
                      <div className="overflow-hidden border border-neutral-200 bg-white" key={patch.patchId}>
                        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-100 px-4 py-3">
                          <div className="font-mono text-sm font-bold">{patch.filePath}</div>
                          <span className="bg-black px-2 py-1 text-[10px] font-bold tracking-[0.1em] text-white">
                            {patch.operation === 'replace' ? '교체' : '추가'}
                          </span>
                        </div>
                        {patch.operation === 'replace' ? (
                          <div className="grid grid-cols-1 divide-y divide-neutral-200 font-mono text-sm md:grid-cols-2 md:divide-x md:divide-y-0">
                            <div className="whitespace-pre-wrap bg-rose-50 p-4 text-rose-900">
                              <div className="mb-2 text-xs font-bold text-rose-500">- 수정 전</div>
                              {patch.oldText || <span className="text-rose-400 italic">(원본 텍스트 없음 혹은 파일 내용 전체 교체)</span>}
                            </div>
                            <div className="whitespace-pre-wrap bg-emerald-50 p-4 text-emerald-900">
                              <div className="mb-2 text-xs font-bold text-emerald-500">+ 수정 후</div>
                              {patch.newText || <span className="text-emerald-400 italic">(제거됨)</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap bg-emerald-50 p-4 font-mono text-sm text-emerald-900">
                            <div className="mb-2 text-xs font-bold text-emerald-500">+ 파일 끝에 추가</div>
                            {patch.newText || <span className="text-emerald-400 italic">(추가할 내용 없음)</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-6 py-8 text-center text-sm text-neutral-500">
                    자동 적용 가능한 패치가 없습니다. 권장 조치를 참고해 수동으로 수정해주세요.
                  </div>
                )}

                {scanBasic?.scanMode === 'UPLOAD' ? (
                  <div className="border border-neutral-200 bg-[#fafafa] px-6 py-5 text-sm text-neutral-500">
                    파일 업로드 스캔은 Agent 없이 진행되므로 자동 패치 적용이 지원되지 않습니다.<br />
                    위의 수정 가이드를 참고해 직접 파일을 수정해 주세요.
                  </div>
                ) : (
                  <>
                    <div className="border-2 border-black bg-white p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-black tracking-tight">패치 적용 이력</h3>
                          <p className="mt-2 text-sm text-neutral-600">
                            승인된 패치는 Agent를 통해 실제 서버 파일에 적용됩니다. 적용 전 백업 파일이 자동 생성됩니다.
                          </p>
                        </div>
                        {(() => {
                          const rm = resolutionDisplayMeta[finding.resolutionStatus] ?? resolutionDisplayMeta['OPEN'];
                          return (
                            <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-bold ${rm.cls}`}>
                              <span className={`h-1 w-1 rounded-full ${rm.dot}`} />
                              {rm.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">승인 일시</div>
                          <div className="mt-2 font-mono">
                            {finding.patchApprovedAt
                              ? `${formatDateTime(finding.patchApprovedAt)} by ${finding.patchApprovedActorType?.toLowerCase() || 'user'}${
                                  finding.patchApprovedActorType === 'GUEST' ? '' : ` #${finding.patchApprovedByUserId ?? '-'}`
                                }`
                              : '아직 승인되지 않았습니다.'}
                          </div>
                        </div>
                        <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">적용 일시</div>
                          <div className="mt-2 font-mono">{finding.patchedAt ? formatDateTime(finding.patchedAt) : '아직 적용되지 않았습니다.'}</div>
                        </div>
                        <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">백업 파일</div>
                          <div className="mt-2 font-mono">{finding.backupFileName || '백업 파일 정보가 없습니다.'}</div>
                          {finding.backupFilePath ? <div className="mt-1 break-all font-mono text-xs">{finding.backupFilePath}</div> : null}
                        </div>
                        <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">적용 결과</div>
                          <div className="mt-2">{finding.patchResultMessage || '패치 결과 메시지가 아직 없습니다.'}</div>
                        </div>
                      </div>
                    </div>

                    {finding.backupMetadataJson ? (
                      <div className="bg-black p-6 text-white">
                        <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#3DDC84]">백업 메타데이터</div>
                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap bg-neutral-900 p-4 font-mono text-sm">
                          {prettyJsonText(finding.backupMetadataJson)}
                        </pre>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

          </div>

          <aside className="sticky top-24 h-fit border border-neutral-100 bg-white">
            {/* 헤더 */}
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400">같은 스캔의 항목</p>
              <p className="mt-0.5 text-lg font-black text-black">{relatedFindings.length}<span className="ml-1 text-sm font-normal text-neutral-400">건</span></p>
            </div>

            {/* 목록 */}
            <div className="max-h-[560px] overflow-y-auto">
              {relatedFindings.map((item) => {
                const active = item.findingId === finding.findingId;
                const dimmed = item.resolutionStatus === 'RESOLVED' || item.resolutionStatus === 'IGNORED';
                const rm = resolutionDisplayMeta[item.resolutionStatus] ?? resolutionDisplayMeta['OPEN'];

                return (
                  <Link
                    className={`group relative flex items-stretch gap-0 border-b border-neutral-100 last:border-b-0 transition-colors ${
                      active ? 'bg-[#F4FFD9]' : dimmed ? 'bg-neutral-50 hover:bg-neutral-100' : 'hover:bg-[#FAFAF7]'
                    }`}
                    key={item.findingId}
                    state={routeState}
                    to={ROUTES.resultFindingDetail
                      .replace(':scanId', String(item.scanId))
                      .replace(':findingId', String(item.findingId))}
                  >
                    {/* 심각도 컬러 바 */}
                    <div
                      className="w-1 shrink-0"
                      style={{ background: active ? '#9FCC2E' : severityMeta[item.severity].bg }}
                    />

                    <div className={`min-w-0 flex-1 px-3 py-3 ${dimmed ? 'opacity-50' : ''}`}>
                      {/* 심각도 배지 + ID + 해결 상태 */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                          style={{ background: severityMeta[item.severity].soft, color: severityMeta[item.severity].bg }}
                        >
                          {item.severity}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-400">#{item.findingId}</span>
                        <span className={`ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${rm.cls}`}>
                          <span className={`h-1 w-1 rounded-full ${rm.dot}`} />
                          {rm.label}
                        </span>
                      </div>

                      {/* 제목 */}
                      <p className={`mt-1.5 line-clamp-2 text-xs font-medium leading-snug ${
                        active ? 'text-black' : dimmed ? 'text-neutral-400 line-through' : 'text-neutral-700 group-hover:text-black'
                      }`}>
                        {item.title}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* 푸터 */}
            <div className="border-t border-neutral-100 px-4 py-2.5 font-mono text-[10px] text-neutral-400">
              scan #{scanId}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

export default FindingDetailPage;
