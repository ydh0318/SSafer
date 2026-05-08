import { AlertTriangle, ArrowLeft, ExternalLink, Send, Trophy, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import PixelGoose from '../../components/common/PixelGoose';
import TypingBox from '../../components/common/TypingBox';
import { ROUTES } from '../../constants/routes';
import ServerAuditFindingDetailView from '../../features/results/components/ServerAuditFindingDetailView';
import {
  getScanBasic,
  getScanFindingDetail,
  getScanFindings,
} from '../../features/results/api/results';
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
    return '원본 스니펫 정보가 없습니다.';
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

  const preferred = [
    finding.remediationGuide,
    finding.patchResultMessage,
    finding.title,
  ].find((value) => Boolean(value && value.trim()));

  return preferred ?? '';
}

function formatFindingLocation(finding: Pick<ScanFindingDetailData, 'filePath' | 'resourceName' | 'lineNumber'>) {
  const target = finding.filePath || finding.resourceName || '경로 정보 없음';

  if (finding.lineNumber && finding.lineNumber > 0) {
    return `${target}:${finding.lineNumber}`;
  }

  return target;
}

function FindingDetailPage() {
  const { scanId = '', findingId = '' } = useParams<{ scanId: string; findingId: string }>();
  const location = useLocation();
  const routeState = (location.state ?? {}) as FindingRouteState;

  const [view, setView] = useState<'explain' | 'fix' | 'apply' | 'references'>('explain');
  const [scanBasic, setScanBasic] = useState<ScanBasicData | null>(null);
  const [finding, setFinding] = useState<ScanFindingDetailData | null>(null);
  const [relatedFindings, setRelatedFindings] = useState<ScanFindingListItemData[]>([]);
  const [serverAuditFinding, setServerAuditFinding] = useState<ServerAuditFindingViewModel | null>(null);
  const [serverAuditRelatedFindings, setServerAuditRelatedFindings] = useState<ServerAuditFindingViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

        setErrorMessage(error instanceof Error ? error.message : '취약점 상세 정보를 불러오지 못했습니다.');
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

      {errorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      {isLoading ? (
        <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">
          취약점 상세 정보를 불러오는 중입니다.
        </div>
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

      {!isLoading && currentScanType === 'PROJECT_SCAN' && finding ? (
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
                { id: 'apply', label: '적용 정보', icon: Send },
                { id: 'references', label: '참고 자료', icon: ExternalLink },
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
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">description</div>
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.description || '상세 설명 정보가 아직 제공되지 않았습니다.'}
                  </p>
                </div>
                <div className="border border-neutral-200 bg-white p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">attack scenario</div>
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.attackScenario || '공격 시나리오 정보가 아직 제공되지 않았습니다.'}
                  </p>
                </div>
                <div className="flex items-start gap-4 border border-[#FFE066] bg-[#FFF9DB] p-6">
                  <PixelGoose mood="alert" size={60} />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">SSAFER COMMENT</div>
                    <p className="mt-2 text-sm leading-7 text-neutral-800">
                      우선 file path와 rule code를 기준으로 영향 범위를 확인한 뒤, 조치 가이드와 패치 메타데이터를 함께 보는 것이 가장 안전합니다.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {view === 'fix' ? (
              <div className="mt-6 space-y-6">
                <div className="border border-neutral-200 bg-white p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">remediation guide</div>
                  <p className="mt-3 leading-8 text-neutral-800">
                    {finding.remediationGuide || '조치 가이드 정보가 아직 제공되지 않았습니다.'}
                  </p>
                </div>

                <div className="grid overflow-hidden border border-neutral-200 bg-white xl:grid-cols-2">
                  <div>
                    <div className="border-b border-neutral-200 bg-[#FFE5E5] px-5 py-3 text-xs font-bold tracking-[0.24em] text-[#E63946]">
                      RAW SNIPPET
                    </div>
                    <pre className="overflow-x-auto bg-neutral-900 p-5 font-mono text-sm leading-7 text-neutral-100">
                      {rawSnippetText}
                    </pre>
                  </div>
                  <div className="border-t border-neutral-200 xl:border-l xl:border-t-0">
                    <div className="border-b border-neutral-200 bg-[#E6F9EE] px-5 py-3 text-xs font-bold tracking-[0.24em] text-[#0A7C2E]">
                      RECOMMENDED ACTION
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap bg-neutral-900 p-5 font-mono text-sm leading-7 text-neutral-100">
                      {finding.remediationGuide || '권장 조치 정보가 없습니다.'}
                    </pre>
                  </div>
                </div>

                {practiceSnippet ? (
                  <div className="border-2 border-black bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-[0.24em]">핵심 조치 문장 연습</span>
                      </div>
                      <span className="text-xs text-neutral-500">+10 XP</span>
                    </div>
                    <p className="mt-3 text-sm text-neutral-600">
                      실제 패치 코드는 API에 포함되지 않을 수 있어, 조치 가이드의 핵심 문장을 그대로 따라 적어보며 익힐 수 있게 했습니다.
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
                      <h3 className="text-xl font-black tracking-tight">패치 및 백업 메타데이터</h3>
                      <p className="mt-2 text-sm text-neutral-600">
                        실제 패치 적용 여부와 승인 이력, 백업 파일 위치를 API 응답 기준으로 확인할 수 있습니다.
                      </p>
                    </div>
                    <span className="bg-[#3DDC84] px-2 py-1 text-[10px] font-bold tracking-[0.24em] text-black">
                      {finding.resolutionStatus}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">patch approved</div>
                      <div className="mt-2 font-mono">
                        {finding.patchApprovedAt
                          ? `${formatDateTime(finding.patchApprovedAt)} by user #${finding.patchApprovedByUserId ?? '-'}`
                          : '승인 정보 없음'}
                      </div>
                    </div>
                    <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">patched at</div>
                      <div className="mt-2 font-mono">
                        {finding.patchedAt ? formatDateTime(finding.patchedAt) : '적용 이력 없음'}
                      </div>
                    </div>
                    <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">backup file</div>
                      <div className="mt-2 font-mono">{finding.backupFileName || '백업 파일 없음'}</div>
                      {finding.backupFilePath ? <div className="mt-1 break-all font-mono text-xs">{finding.backupFilePath}</div> : null}
                    </div>
                    <div className="bg-[#F5F5F5] p-4 text-sm text-neutral-700">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">patch result</div>
                      <div className="mt-2">{finding.patchResultMessage || '패치 결과 메시지 없음'}</div>
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
                  { tag: 'AWS', title: 'AWS Secrets Manager 시작하기', url: 'https://docs.aws.amazon.com/' },
                ].map((reference) => (
                  <a
                    className="flex items-center justify-between border border-neutral-200 bg-white p-5 transition hover:border-black"
                    href={reference.url}
                    key={reference.title}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div>
                      <span className="bg-black px-2 py-0.5 text-[10px] font-bold tracking-[0.22em] text-white">
                        {reference.tag}
                      </span>
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
              <span className="text-sm font-bold">이 스캔의 다른 finding</span>
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
              <span>{relatedFindings.length}개 finding</span>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

export default FindingDetailPage;
