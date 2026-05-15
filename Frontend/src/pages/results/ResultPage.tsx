import { AlertCircle, ArrowLeft, CheckCircle2, FileText, GitBranch, RefreshCw, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import ServerAuditResultView from '../../features/results/components/ServerAuditResultView';
import { getScanBasic, getScanFindings, getScanSummary } from '../../features/results/api/results';
import ScanModeBadge from '../../features/scans/components/ScanModeBadge';
import ScanStatusBadge from '../../features/scans/components/ScanStatusBadge';
import ScanTypeBadge from '../../features/scans/components/ScanTypeBadge';
import { formatDateTime, getSafeScanType } from '../../features/scans/utils/scanPresentation';
import type {
  FindingResolutionStatus,
  FindingSeverity,
  ScanBasicData,
  ScanFindingListItemData,
  ScanFindingListResponseData,
  ScanSummaryData,
  ServerAuditResultViewModel,
} from '../../types/scan';

type ResultRouteState = {
  projectId?: string;
};

const severityMeta: Record<FindingSeverity, { bg: string; fg: string; soft: string; label: string }> = {
  CRITICAL: { bg: '#E63946', fg: '#FFFFFF', soft: '#FFE5E5', label: 'CRITICAL' },
  HIGH: { bg: '#FF8A33', fg: '#FFFFFF', soft: '#FFF1E5', label: 'HIGH' },
  MEDIUM: { bg: '#FFB627', fg: '#111111', soft: '#FFF9DB', label: 'MEDIUM' },
  LOW: { bg: '#3D5AFE', fg: '#FFFFFF', soft: '#E5EBFF', label: 'LOW' },
  INFO: { bg: '#9CA3AF', fg: '#FFFFFF', soft: '#F3F4F6', label: 'INFO' },
};

const severityOrder: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const resolutionValues = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED'] as const;

const resolutionMeta: Record<typeof resolutionValues[number], { label: string; cls: string; dot: string }> = {
  OPEN:        { label: '미해결',   cls: 'bg-neutral-100 text-neutral-600',                        dot: 'bg-neutral-400' },
  IN_PROGRESS: { label: '처리 중',  cls: 'border border-amber-200 bg-amber-50 text-amber-700',     dot: 'bg-amber-400'   },
  RESOLVED:    { label: '해결 완료', cls: 'bg-[#EDFFC0] text-[#4A7A00]',                           dot: 'bg-[#9FCC2E]'   },
  IGNORED:     { label: '무시됨',   cls: 'bg-neutral-100 text-neutral-400',                        dot: 'bg-neutral-300' },
};

const emptyFindingList: ScanFindingListResponseData = {
  items: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

function getResolutionCount(summary: ScanSummaryData | null, status: FindingResolutionStatus) {
  return summary?.resolutionCounts?.[status] ?? 0;
}

function getSourceCount(summary: ScanSummaryData | null, sourceType: string) {
  return summary?.sourceCounts?.[sourceType] ?? 0;
}

function formatFindingLocation(finding: ScanFindingListItemData) {
  const target = finding.filePath || finding.resourceName || '위치를 확인할 수 없는 항목';

  if (finding.lineNumber && finding.lineNumber > 0) {
    return `${target}:${finding.lineNumber}`;
  }

  return target;
}

function ResultPage() {
  const { scanId = '' } = useParams<{ scanId: string }>();
  const location = useLocation();
  const routeState = (location.state ?? {}) as ResultRouteState;

  const [scanBasic, setScanBasic] = useState<ScanBasicData | null>(null);
  const [summary, setSummary] = useState<ScanSummaryData | null>(null);
  const [findingsData, setFindingsData] = useState<ScanFindingListResponseData>(emptyFindingList);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFindingsLoading, setIsFindingsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | FindingSeverity>('all');
  const [resolutionFilter, setResolutionFilter] = useState<'all' | FindingResolutionStatus>('all');
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [severityFilter, resolutionFilter, scanId]);

  useEffect(() => {
    if (!scanId) {
      return;
    }

    let isMounted = true;

    const loadOverview = async () => {
      setIsInitialLoading(true);
      setErrorMessage(null);

      try {
        const basicData = await getScanBasic(scanId);

        if (!isMounted) {
          return;
        }

        setScanBasic(basicData);

        const summaryData = await getScanSummary(scanId);

        if (!isMounted) {
          return;
        }

        setSummary(summaryData);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : '스캔 결과를 불러오지 못했습니다.');
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    };

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, [scanId]);

  useEffect(() => {
    if (!scanId) {
      return;
    }

    let isMounted = true;

    const loadFindings = async () => {
      setIsFindingsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getScanFindings(scanId, {
          severity: severityFilter === 'all' ? undefined : severityFilter,
          resolutionStatus: resolutionFilter === 'all' ? undefined : resolutionFilter,
          page,
          size: 20,
        });

        if (!isMounted) {
          return;
        }

        setFindingsData(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : '탐지 항목 목록을 불러오지 못했습니다.');
        setFindingsData(emptyFindingList);
      } finally {
        if (isMounted) {
          setIsFindingsLoading(false);
        }
      }
    };

    void loadFindings();

    return () => {
      isMounted = false;
    };
  }, [page, resolutionFilter, scanBasic?.scanType, scanId, severityFilter]);

  const counts = useMemo(
    () => ({
      CRITICAL: summary?.criticalCount ?? 0,
      HIGH: summary?.highCount ?? 0,
      MEDIUM: summary?.mediumCount ?? 0,
      LOW: summary?.lowCount ?? 0,
      INFO: summary?.infoCount ?? 0,
      total: summary?.totalFindings ?? 0,
    }),
    [summary],
  );

  const actionableTotal = Math.max((summary?.totalFindings ?? 0) - getResolutionCount(summary, 'IGNORED'), 1);
  const resolvedCount = getResolutionCount(summary, 'RESOLVED');
  const resolvedRatio = Math.round((resolvedCount / actionableTotal) * 100);
  const routeProjectId = routeState.projectId ? Number(routeState.projectId) : undefined;
  const currentProjectId = scanBasic?.projectId ?? routeProjectId;
  const currentScanType = getSafeScanType(scanBasic?.scanType);

  const serverAuditViewModel = useMemo<ServerAuditResultViewModel | null>(() => {
    if (currentScanType !== 'SERVER_AUDIT' || !scanBasic) {
      return null;
    }
    return {
      scanId: scanBasic.scanId,
      projectId: scanBasic.projectId,
      scanType: 'SERVER_AUDIT',
      status: scanBasic.status,
      targetLabel: 'Agent 서버',
      hostLabel: '',
      generatedAt: scanBasic.completedAt ?? scanBasic.requestedAt,
      findings: findingsData.items.map((f) => ({
        findingId: f.findingId,
        title: f.title,
        severity: f.severity,
        category: f.category,
        target: f.filePath ?? f.resourceName ?? '-',
        summary: f.title,
        evidence: null,
        observedAt: f.createdAt,
        recommendation: '',
        relatedWarnings: [],
        relatedArtifacts: [],
        actions: [],
      })),
      warnings: [],
      artifacts: [],
      actions: [],
    };
  }, [currentScanType, scanBasic, findingsData.items]);

  const groupedFindings = useMemo(() => {
    return severityOrder
      .map((severity) => ({
        severity,
        items: findingsData.items.filter((finding) => finding.severity === severity),
      }))
      .filter((group) => group.items.length > 0);
  }, [findingsData.items]);

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className="inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-black"
          state={routeState}
          to={ROUTES.scanDetail.replace(':scanId', scanId)}
        >
          <ArrowLeft className="h-4 w-4" />
          스캔 진행 화면으로 돌아가기
        </Link>
      </div>

      <PageHero
        actions={
          <>
            <Link
              className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
              to={ROUTES.history}
            >
              <GitBranch className="h-4 w-4" />
              결과 비교 보기
            </Link>
            <button
              className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
              onClick={() => {
                if (!scanId) {
                  return;
                }

                void getScanBasic(scanId).then((basicData) => {
                  setScanBasic(basicData);
                  void getScanSummary(scanId).then((summaryData) => {
                    setSummary(summaryData);
                  });
                });
              }}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              새로고침
            </button>
            <button
              className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-400"
              disabled
              type="button"
            >
              <FileText className="h-4 w-4" />
              내보내기 준비 중
            </button>
          </>
        }
        aside={
          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">SCAN SNAPSHOT</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight">Scan #{scanId}</h2>
              </div>
              <PixelGoose mood={resolvedCount > 0 ? 'happy' : 'alert'} size={84} />
            </div>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              결과 화면에서는 위험도별 분포, 탐지 위치, 해결 상태를 한 번에 볼 수 있습니다. 수정이 필요한 항목부터 순서대로 확인해 보세요.
            </p>
          </div>
        }
        description={
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
              <span className="font-mono">scanId #{scanId}</span>
              {scanBasic ? <ScanStatusBadge status={scanBasic.status} /> : null}
              {scanBasic ? <ScanTypeBadge scanType={scanBasic.scanType} /> : null}
              {currentProjectId ? <span>projectId #{currentProjectId}</span> : null}
              {scanBasic ? <ScanModeBadge scanMode={scanBasic.scanMode} source={scanBasic.source} /> : null}
            </div>
            <p className="text-neutral-600">
              {scanBasic?.completedAt
                ? `완료 시각: ${formatDateTime(scanBasic.completedAt)}`
                : '아직 분석이 끝나지 않았습니다. 결과가 완전히 준비되면 더 많은 항목을 확인할 수 있습니다.'}
            </p>
          </div>
        }
        eyebrow="SCAN RESULT"
        title={currentScanType === 'SERVER_AUDIT' ? '서버 점검 결과와 권장 조치' : '스캔 결과 체크리스트'}
      />

      {errorMessage ? <PageBanner message={errorMessage} tone="error" /> : null}

      {isInitialLoading ? (
        <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">스캔 결과를 불러오는 중입니다.</div>
      ) : null}

      {!isInitialLoading && currentScanType === 'SERVER_AUDIT' && serverAuditViewModel ? (
        <ServerAuditResultView result={serverAuditViewModel} routeState={routeState} />
      ) : null}

      {!isInitialLoading && currentScanType === 'PROJECT_FILE' && summary ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {severityOrder.map((severity) => {
              const meta = severityMeta[severity];
              const count = counts[severity];
              return (
                <div
                  className="relative overflow-hidden border border-neutral-200 bg-white p-5"
                  key={severity}
                  style={{ borderLeftColor: meta.bg, borderLeftWidth: '3px' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full"
                      style={{ background: meta.soft }}
                    >
                      <AlertCircle className="h-3.5 w-3.5" style={{ color: meta.bg }} />
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: meta.bg }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className={`mt-3 text-4xl font-black ${count === 0 ? 'text-neutral-200' : 'text-black'}`}>
                    {count}
                  </div>
                  {count > 0 && (
                    <div
                      className="absolute bottom-0 right-0 h-1 w-full opacity-30"
                      style={{ background: meta.bg }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-6 border border-neutral-200 bg-white p-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-6">
              <PixelGoose mood={resolvedRatio > 30 ? 'happy' : 'working'} size={72} />
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.28em] text-neutral-500">CHECKLIST PROGRESS</div>
                <div className="mt-2 text-3xl font-black">
                  {resolvedCount}
                  <span className="text-neutral-300"> / {actionableTotal}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {resolutionValues.map((value) => {
                    const m = resolutionMeta[value];
                    const cnt = getResolutionCount(summary, value);
                    return (
                      <span key={value} className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-bold ${m.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                        {m.label} {cnt}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="w-full xl:max-w-[420px]">
              <div className="mb-2 text-sm text-neutral-500">전체 진행률 {resolvedRatio}%</div>
              <div className="h-3 bg-neutral-100">
                <div className="h-full bg-[#3DDC84]" style={{ width: `${resolvedRatio}%` }} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">severity</span>
            <button
              className={`border px-3 py-1.5 text-xs ${
                severityFilter === 'all' ? 'border-black bg-black text-white' : 'border-neutral-300 bg-white'
              }`}
              onClick={() => setSeverityFilter('all')}
              type="button"
            >
              전체
            </button>
            {severityOrder.map((severity) => {
              const active = severityFilter === severity;
              return (
                <button
                  className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold transition ${
                    active ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
                  }`}
                  key={severity}
                  onClick={() => setSeverityFilter(severity)}
                  type="button"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: active ? 'white' : severityMeta[severity].bg }}
                  />
                  {severity}
                  <span className={`font-mono ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>{counts[severity]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">resolution</span>
            <button
              className={`border px-3 py-1.5 text-xs ${
                resolutionFilter === 'all' ? 'border-black bg-black text-white' : 'border-neutral-300 bg-white'
              }`}
              onClick={() => setResolutionFilter('all')}
              type="button"
            >
              전체
            </button>
            {resolutionValues.map((value) => {
              const active = resolutionFilter === value;
              const m = resolutionMeta[value];
              return (
                <button
                  className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold transition ${
                    active ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
                  }`}
                  key={value}
                  onClick={() => setResolutionFilter(value)}
                  type="button"
                >
                  <span className={`h-2 w-2 rounded-full ${active ? 'bg-white' : m.dot}`} />
                  {m.label}
                </button>
              );
            })}
            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <span>TRIVY {getSourceCount(summary, 'TRIVY')}</span>
              <span>CUSTOM RULE {getSourceCount(summary, 'CUSTOM_RULE')}</span>
              <span>AI {getSourceCount(summary, 'AI')}</span>
            </div>
          </div>

          <div className="space-y-4">
            {isFindingsLoading ? (
              <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">탐지 항목을 불러오는 중입니다.</div>
            ) : groupedFindings.length === 0 ? (
              <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">조건에 맞는 탐지 항목이 없습니다.</div>
            ) : (
              groupedFindings.map((group) => (
                <section className="border border-neutral-200 bg-white" key={group.severity}>
                  <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-1 text-[10px] font-bold tracking-[0.22em]"
                        style={{ background: severityMeta[group.severity].bg, color: severityMeta[group.severity].fg }}
                      >
                        {group.severity}
                      </span>
                      <span className="text-sm font-bold">{group.items.length}건</span>
                    </div>
                    <span className="text-xs text-neutral-500">위험도가 높은 항목부터 먼저 확인해 보세요.</span>
                  </div>

                  {group.items.map((finding) => {
                    const dimmed = finding.resolutionStatus === 'RESOLVED' || finding.resolutionStatus === 'IGNORED';

                    return (
                      <Link
                        className={`group flex items-start gap-4 border-b border-neutral-100 p-5 last:border-b-0 hover:bg-[#F5F5F5] ${
                          dimmed ? 'opacity-60' : ''
                        }`}
                        key={finding.findingId}
                        state={routeState}
                        to={ROUTES.resultFindingDetail
                          .replace(':scanId', String(finding.scanId))
                          .replace(':findingId', String(finding.findingId))}
                      >
                        <div className="flex shrink-0 items-start pt-1">
                          <CheckCircle2 className={`h-5 w-5 ${dimmed ? 'text-emerald-500' : 'text-neutral-300'}`} />
                        </div>
                        <div className="w-1 self-stretch" style={{ background: severityMeta[finding.severity].bg }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-neutral-500">findingId #{finding.findingId}</span>
                            <span className="bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.2em]">{finding.category}</span>
                            <span className="bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.2em]">{finding.sourceType}</span>
                            <span className="font-mono text-[10px] text-neutral-600">{finding.ruleCode}</span>
                            <span className={`ml-auto inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${resolutionMeta[finding.resolutionStatus].cls}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${resolutionMeta[finding.resolutionStatus].dot}`} />
                              {resolutionMeta[finding.resolutionStatus].label}
                            </span>
                          </div>
                          <h3 className={`mt-3 text-base font-bold ${dimmed ? 'line-through' : ''}`}>{finding.title}</h3>
                          <div className="mt-2 font-mono text-xs text-neutral-500">{formatFindingLocation(finding)}</div>
                        </div>
                        {!dimmed ? (
                          <span className="inline-flex items-center gap-1 bg-black px-3 py-1.5 text-xs font-bold text-white transition group-hover:bg-[#3DDC84] group-hover:text-black">
                            <Wand2 className="h-3 w-3" />
                            고치기
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </section>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-500">
            <span>
              총 {findingsData.totalElements}건 중 {findingsData.totalElements === 0 ? 0 : page * findingsData.size + 1}-
              {Math.min((page + 1) * findingsData.size, findingsData.totalElements)} 표시
            </span>
            <div className="flex items-center gap-2">
              <button
                className="border border-neutral-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page <= 0}
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
                type="button"
              >
                이전
              </button>
              <span className="font-mono text-xs">
                {findingsData.totalPages === 0 ? 0 : page + 1} / {findingsData.totalPages}
              </span>
              <button
                className="border border-neutral-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={findingsData.totalPages === 0 || page >= findingsData.totalPages - 1}
                onClick={() =>
                  setPage((current) =>
                    findingsData.totalPages === 0 ? current : Math.min(current + 1, findingsData.totalPages - 1),
                  )
                }
                type="button"
              >
                다음
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default ResultPage;
