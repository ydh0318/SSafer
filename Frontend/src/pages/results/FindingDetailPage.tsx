import { AlertTriangle, ArrowLeft, Copy, ExternalLink, Send, Trophy, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import InlineMessage from '../../components/common/InlineMessage';
import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import TypingBox from '../../components/common/TypingBox';
import { ROUTES } from '../../constants/routes';
import { useToast } from '../../features/feedback/useToast';
import ServerAuditFindingDetailView from '../../features/results/components/ServerAuditFindingDetailView';
import { getScanBasic, getScanFindingDetail, getScanFindings } from '../../features/results/api/results';
import { approveFindingPatch } from '../../features/scans/api/scans';
import ScanTypeBadge from '../../features/scans/components/ScanTypeBadge';
import { formatDateTime, getSafeScanType } from '../../features/scans/utils/scanPresentation';
import { buildMockServerAuditResult, getMockServerAuditFinding } from '../../mocks/serverAudit';
import type {
  FindingSeverity,
  ScanBasicData,
  ScanFindingDetailData,
  ScanFindingListItemData,
  ServerAuditFindingViewModel,
} from '../../types/scan';

type FindingRouteState = {
  projectId?: string;
};

const severityMeta: Record<FindingSeverity, { bg: string; fg: string }> = {
  CRITICAL: { bg: '#E63946', fg: '#FFFFFF' },
  HIGH: { bg: '#FF8A33', fg: '#FFFFFF' },
  MEDIUM: { bg: '#FFB627', fg: '#111111' },
  LOW: { bg: '#3D5AFE', fg: '#FFFFFF' },
  INFO: { bg: '#9CA3AF', fg: '#FFFFFF' },
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

function formatFindingLocation(finding: Pick<ScanFindingDetailData, 'filePath' | 'resourceName' | 'lineNumber'>) {
  const target = finding.filePath || finding.resourceName || '위치를 확인할 수 없는 항목';

  if (finding.lineNumber && finding.lineNumber > 0) {
    return `${target}:${finding.lineNumber}`;
  }

  return target;
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
  const [serverAuditFinding, setServerAuditFinding] = useState<ServerAuditFindingViewModel | null>(null);
  const [serverAuditRelatedFindings, setServerAuditRelatedFindings] = useState<ServerAuditFindingViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApprovingPatch, setIsApprovingPatch] = useState(false);
  const [approveErrorMessage, setApproveErrorMessage] = useState<string | null>(null);

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

        if (getSafeScanType(basicData.scanType) === 'SERVER_AUDIT') {
          const mockResult = buildMockServerAuditResult(basicData);
          setServerAuditFinding(getMockServerAuditFinding(Number(scanId), Number(findingId)));
          setServerAuditRelatedFindings(mockResult.findings);
          setFinding(null);
          setRelatedFindings([]);
          return;
        }

        const [detailData, findingListData] = await Promise.all([
          getScanFindingDetail(scanId, findingId),
          getScanFindings(scanId, { page: 0, size: 100 }),
        ]);

        if (!isMounted) {
          return;
        }

        setFinding(detailData);
        setRelatedFindings(findingListData.items);
        setServerAuditFinding(null);
        setServerAuditRelatedFindings([]);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : '탐지 항목 상세 정보를 불러오지 못했습니다.');
        setScanBasic(null);
        setFinding(null);
        setRelatedFindings([]);
        setServerAuditFinding(null);
        setServerAuditRelatedFindings([]);
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
  const currentScanType = getSafeScanType(scanBasic?.scanType);

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

      {!isLoading && currentScanType === 'SERVER_AUDIT' && serverAuditFinding ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <span className="font-mono">scanId #{scanId}</span>
            <ScanTypeBadge scanType="SERVER_AUDIT" />
          </div>
          <ServerAuditFindingDetailView
            finding={serverAuditFinding}
            relatedFindings={serverAuditRelatedFindings}
            routeState={routeState}
            scanId={scanId}
          />
        </div>
      ) : null}

      {!isLoading && currentScanType === 'PROJECT_FILE' && finding ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="border border-neutral-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="px-2 py-1 text-[10px] font-bold tracking-[0.24em]"
                    style={{
                      background: severityMeta[finding.severity].bg,
                      color: severityMeta[finding.severity].fg,
                    }}
                  >
                    {finding.severity}
                  </span>
                  <span className="font-mono text-xs text-neutral-500">findingId #{finding.findingId}</span>
                  <span className="font-mono text-xs text-neutral-500">{finding.ruleCode}</span>
                  <span className="border border-neutral-300 px-2 py-0.5 text-xs">{finding.sourceType}</span>
                  <span className="bg-neutral-100 px-2 py-0.5 text-xs">{finding.category}</span>
                </div>
                <span className="border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600">
                  {finding.resolutionStatus}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight">{finding.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-sm text-neutral-500">
                <span>{formatFindingLocation(finding)}</span>
                <span>scanId #{scanId}</span>
                {finding.scanNodeId ? <span>scanNodeId #{finding.scanNodeId}</span> : null}
                {finding.fingerprint ? <span>{finding.fingerprint}</span> : null}
              </div>
            </div>

            <div className="mt-6 flex border-b border-neutral-300">
              {[
                { id: 'explain', label: '왜 위험한가', icon: AlertTriangle },
                { id: 'fix', label: '어떻게 고치나', icon: Wand2 },
                { id: 'apply', label: '패치 적용', icon: Send },
                { id: 'references', label: '참고 링크', icon: ExternalLink },
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
                <div className="border border-neutral-200 bg-white p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">WHY RISKY</div>
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.description || '이 항목이 왜 위험한지에 대한 설명이 아직 제공되지 않았습니다.'}
                  </p>
                </div>
                <div className="border border-neutral-200 bg-white p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">REAL WORLD IMPACT</div>
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.attackScenario || '실제 공격 시나리오나 영향 범위 설명이 아직 제공되지 않았습니다.'}
                  </p>
                </div>
                <div className="flex items-start gap-4 border border-[#FFE066] bg-[#FFF9DB] p-6">
                  <PixelGoose mood="alert" size={60} />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">PLAIN LANGUAGE</div>
                    <p className="mt-2 text-sm leading-7 text-neutral-800">
                      이 설정은 외부에 노출되었거나 권한이 넓어 보일 수 있습니다. 우선 탐지 위치와 수정 가이드를 보고, 적용 가능한 수정안을 먼저 확인해 보세요.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {view === 'fix' ? (
              <div className="mt-6 space-y-6">
                <div className="border border-neutral-200 bg-white p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">REMEDIATION GUIDE</div>
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.remediationGuide || '이 항목에 대한 수정 가이드가 아직 제공되지 않았습니다.'}
                  </p>
                </div>

                <div className="grid overflow-hidden border border-neutral-200 bg-white xl:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between border-b border-neutral-200 bg-[#FFE5E5] px-5 py-3 text-xs font-bold tracking-[0.24em] text-[#E63946]">
                      <span>RAW SNIPPET</span>
                      <button
                        className="inline-flex items-center gap-1 text-[11px] font-semibold"
                        onClick={() => void copyText(rawSnippetText, '원본 코드가 복사되었습니다.')}
                        type="button"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        복사
                      </button>
                    </div>
                    <pre className="overflow-x-auto bg-neutral-900 p-5 font-mono text-sm leading-7 text-neutral-100">
                      {rawSnippetText}
                    </pre>
                  </div>
                  <div className="border-t border-neutral-200 xl:border-l xl:border-t-0">
                    <div className="flex items-center justify-between border-b border-neutral-200 bg-[#E6F9EE] px-5 py-3 text-xs font-bold tracking-[0.24em] text-[#0A7C2E]">
                      <span>RECOMMENDED ACTION</span>
                      <button
                        className="inline-flex items-center gap-1 text-[11px] font-semibold"
                        onClick={() =>
                          void copyText(
                            finding.remediationGuide || '수정 가이드가 아직 없습니다.',
                            '수정 가이드가 복사되었습니다.',
                          )
                        }
                        type="button"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        복사
                      </button>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap bg-neutral-900 p-5 font-mono text-sm leading-7 text-neutral-100">
                      {finding.remediationGuide || '수정 가이드가 아직 없습니다.'}
                    </pre>
                  </div>
                </div>

                {practiceSnippet ? (
                  <div className="border-2 border-black bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-[0.24em]">수정안 연습</span>
                      </div>
                      <span className="text-xs text-neutral-500">Typing Practice</span>
                    </div>
                    <p className="mt-3 text-sm text-neutral-600">
                      아래 수정안을 직접 읽어보면서 적용 흐름을 미리 점검해 보세요.
                    </p>
                    <div className="mt-4">
                      <TypingBox snippet={practiceSnippet} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {view === 'apply' ? (
              <div className="mt-6 space-y-6">
                <div className="border-2 border-black bg-white p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black tracking-tight">패치 승인 상태</h3>
                      <p className="mt-2 text-sm text-neutral-600">
                        자동 패치가 가능한 항목은 승인 후 작업이 큐에 등록됩니다. 백엔드와 Agent 준비 상태에 따라 실제 적용 시점은 달라질 수 있습니다.
                      </p>
                    </div>
                    <span className="bg-[#3DDC84] px-2 py-1 text-[10px] font-bold tracking-[0.24em] text-black">
                      {finding.resolutionStatus}
                    </span>
                  </div>
                  {finding.resolutionStatus === 'OPEN' && finding.patchPayloadJson ? (
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        className="inline-flex items-center justify-center bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                        disabled={isApprovingPatch}
                        onClick={() => {
                          void handleApprovePatch();
                        }}
                        type="button"
                      >
                        {isApprovingPatch ? '승인 요청 중...' : '패치 승인'}
                      </button>
                    </div>
                  ) : null}
                  {approveErrorMessage ? <InlineMessage className="mt-5" message={approveErrorMessage} tone="error" /> : null}
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">patch approved</div>
                      <div className="mt-2 font-mono">
                        {finding.patchApprovedAt
                          ? `${formatDateTime(finding.patchApprovedAt)} by ${finding.patchApprovedActorType?.toLowerCase() || 'user'}${
                              finding.patchApprovedActorType === 'GUEST' ? '' : ` #${finding.patchApprovedByUserId ?? '-'}`
                            }`
                          : '아직 승인되지 않았습니다.'}
                      </div>
                    </div>
                    <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">patched at</div>
                      <div className="mt-2 font-mono">{finding.patchedAt ? formatDateTime(finding.patchedAt) : '아직 적용되지 않았습니다.'}</div>
                    </div>
                    <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">backup file</div>
                      <div className="mt-2 font-mono">{finding.backupFileName || '백업 파일 정보가 없습니다.'}</div>
                      {finding.backupFilePath ? <div className="mt-1 break-all font-mono text-xs">{finding.backupFilePath}</div> : null}
                    </div>
                    <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">patch result</div>
                      <div className="mt-2">{finding.patchResultMessage || '패치 결과 메시지가 아직 없습니다.'}</div>
                    </div>
                  </div>
                </div>

                {finding.backupMetadataJson ? (
                  <div className="bg-black p-6 text-white">
                    <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#3DDC84]">backup metadata</div>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap bg-neutral-900 p-4 font-mono text-sm">
                      {prettyJsonText(finding.backupMetadataJson)}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}

            {view === 'references' ? (
              <div className="mt-6 space-y-3">
                {[
                  { tag: 'OWASP', title: 'OWASP Secrets Management Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/' },
                  { tag: 'BEST PRACTICE', title: '12 Factor App - Config', url: 'https://12factor.net/config' },
                  { tag: 'REPORT', title: 'GitGuardian State of Secrets Sprawl', url: 'https://blog.gitguardian.com/' },
                  { tag: 'AWS', title: 'AWS Secrets Manager 문서', url: 'https://docs.aws.amazon.com/' },
                ].map((reference) => (
                  <a
                    className="flex items-center justify-between border border-neutral-200 bg-white p-5 transition hover:border-black"
                    href={reference.url}
                    key={reference.title}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div>
                      <span className="bg-black px-2 py-0.5 text-[10px] font-bold tracking-[0.22em] text-white">{reference.tag}</span>
                      <div className="mt-2 font-bold">{reference.title}</div>
                      <div className="mt-1 font-mono text-xs text-neutral-500">{reference.url}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-neutral-400" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="sticky top-24 h-fit border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <span className="text-sm font-bold">같은 스캔의 다른 항목</span>
              <span className="text-xs text-neutral-400">{relatedFindings.length}건</span>
            </div>
            <div>
              {relatedFindings.map((item) => {
                const active = item.findingId === finding.findingId;
                const dimmed = item.resolutionStatus === 'RESOLVED' || item.resolutionStatus === 'IGNORED';

                return (
                  <Link
                    className={`block border-b border-neutral-100 p-3 last:border-b-0 hover:bg-[#F5F5F5] ${
                      active ? 'border-l-2 border-l-black bg-[#F5F5F5]' : ''
                    } ${dimmed ? 'opacity-50' : ''}`}
                    key={item.findingId}
                    state={routeState}
                    to={ROUTES.resultFindingDetail
                      .replace(':scanId', String(item.scanId))
                      .replace(':findingId', String(item.findingId))}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: severityMeta[item.severity].bg }} />
                      <span className="font-mono text-[10px] text-neutral-500">#{item.findingId}</span>
                      <span className="ml-auto text-[9px] tracking-[0.18em] text-neutral-400">{item.resolutionStatus}</span>
                    </div>
                    <div className={`mt-1 text-sm font-medium ${dimmed ? 'line-through' : ''}`}>{item.title}</div>
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-3 text-xs text-neutral-500">
              <span>scanId #{scanId}</span>
              <span>총 {relatedFindings.length}건</span>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

export default FindingDetailPage;
