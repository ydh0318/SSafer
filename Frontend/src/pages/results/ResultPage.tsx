import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, GitBranch, RefreshCw, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import PageHero from '../../components/common/PageHero';
import { ROUTES } from '../../constants/routes';
import { getProjectDetail } from '../../features/projects/api/projects';
import { getScanBasic, getScanFindingDetail, getScanFindings, getScanSummary } from '../../features/results/api/results';
import ScanScopeInfo from '../../features/results/components/ScanScopeInfo';
import ScanModeBadge from '../../features/scans/components/ScanModeBadge';
import ScanStatusBadge from '../../features/scans/components/ScanStatusBadge';
import ScanTypeBadge from '../../features/scans/components/ScanTypeBadge';
import { formatDateTime, getSafeScanType } from '../../features/scans/utils/scanPresentation';
import type {
  FindingResolutionStatus,
  FindingSeverity,
  ScanBasicData,
  ScanFindingDetailData,
  ScanFindingListItemData,
  ScanFindingListResponseData,
  ScanSummaryData,
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
  const [projectName, setProjectName] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummaryData | null>(null);
  const [findingsData, setFindingsData] = useState<ScanFindingListResponseData>(emptyFindingList);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFindingsLoading, setIsFindingsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | FindingSeverity>('all');
  const [resolutionFilter, setResolutionFilter] = useState<'all' | FindingResolutionStatus>('all');
  const [page, setPage] = useState(0);
  const [serverAuditDetails, setServerAuditDetails] = useState<Map<number, ScanFindingDetailData>>(new Map());

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

        // 프로젝트명 병렬 로드
        void getProjectDetail(String(basicData.projectId))
          .then((p) => { if (isMounted) setProjectName(p.name); })
          .catch(() => {});

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
        const isServerAudit = getSafeScanType(scanBasic?.scanType) === 'SERVER_AUDIT';
        const data = await getScanFindings(scanId, {
          severity: severityFilter === 'all' ? undefined : severityFilter,
          resolutionStatus: resolutionFilter === 'all' ? undefined : resolutionFilter,
          page,
          size: isServerAudit ? 100 : 20,
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

  // SERVER_AUDIT 전용: 각 finding 상세를 병렬 fetch해서 summary/evidence/recommendation 보강
  useEffect(() => {
    if (!scanId || getSafeScanType(scanBasic?.scanType) !== 'SERVER_AUDIT' || findingsData.items.length === 0) {
      return;
    }

    let isMounted = true;

    const fetchDetails = async () => {
      const settled = await Promise.allSettled(
        findingsData.items.map((f) => getScanFindingDetail(scanId, f.findingId)),
      );

      if (!isMounted) return;

      const map = new Map<number, ScanFindingDetailData>();
      settled.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          const f = findingsData.items[idx];
          if (f) map.set(f.findingId, result.value);
        }
      });

      setServerAuditDetails(map);
    };

    void fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [scanId, scanBasic?.scanType, findingsData.items]);

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

  const groupedFindings = useMemo(() => {
    return severityOrder
      .map((severity) => ({
        severity,
        items: findingsData.items.filter((finding) => finding.severity === severity),
      }))
      .filter((group) => group.items.length > 0);
  }, [findingsData.items]);

  const projectBackPath = routeState.projectId
    ? ROUTES.projectDetail.replace(':projectId', routeState.projectId)
    : ROUTES.projects;

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className="inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-black"
          to={projectBackPath}
        >
          <ArrowLeft className="h-4 w-4" />
          프로젝트 화면으로 돌아가기
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
          <div className="border border-neutral-100 bg-white p-6">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">Scan Snapshot</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight">#{scanId}</h2>
            <dl className="mt-4 space-y-2 text-sm">
              {summary && (
                <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
                  <dt className="text-neutral-500">총 탐지</dt>
                  <dd className="font-bold">{summary.totalFindings}건</dd>
                </div>
              )}
              {summary && counts.CRITICAL > 0 && (
                <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
                  <dt className="text-neutral-500">Critical</dt>
                  <dd className="font-bold text-[#E63946]">{counts.CRITICAL}건</dd>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
                <dt className="text-neutral-500">해결 완료</dt>
                <dd className="font-bold text-[#4A7A00]">{resolvedCount}건</dd>
              </div>
            </dl>
          </div>
        }
        description={
          <div className="space-y-2.5">
            {currentProjectId && (
              <Link
                className="inline-flex items-center gap-1.5 text-sm font-bold text-black transition hover:opacity-70"
                state={routeState}
                to={ROUTES.projectDetail.replace(':projectId', String(currentProjectId))}
              >
                {projectName ?? `Project #${currentProjectId}`}
                <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
              <span className="font-mono text-neutral-400">scan #{scanId}</span>
              {scanBasic ? <ScanStatusBadge status={scanBasic.status} /> : null}
              {scanBasic ? <ScanTypeBadge scanType={scanBasic.scanType} /> : null}
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

      {!isInitialLoading && summary ? (
        <>
          {currentScanType === 'SERVER_AUDIT' ? (
            <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-black text-amber-950">서버 런타임 점검 결과입니다.</p>
                <p>
                  실행 중인 서버의 포트, Docker publish, 방화벽, SSH, nginx, 프로세스 상태를 기준으로 판단합니다.
                  sudo 권한이나 OS package scan 옵션에 따라 일부 점검은 제한될 수 있습니다.
                </p>
                <p className="mt-2 font-bold text-amber-950">
                  {
                    '\uc11c\ubc84 \uc810\uac80\uc740 \uc6b4\uc601 \ud658\uacbd\uc758 \ud604\uc7ac \uc0c1\ud0dc\ub97c \ubcf4\ub294 \uac83\uc774\ub77c \uc6d0\uc778\uc774 \uc18c\uc2a4 \ud30c\uc77c, \uc11c\ubc84 \uc124\uc815, \ubc29\ud654\ubcbd \uc911 \uc5b4\ub514\uc778\uc9c0 \ub2e8\uc815\ud558\uae30 \uc5b4\ub835\uc2b5\ub2c8\ub2e4. \uc790\ub3d9 \ud328\uce58\ub294 \uc811\uadfc \ucc28\ub2e8\uc774\ub098 \uc11c\ube44\uc2a4 \uc911\ub2e8\uc73c\ub85c \uc774\uc5b4\uc9c8 \uc218 \uc788\uc5b4, \uad8c\uc7a5 \uc870\uce58\ub97c \ud655\uc778\ud55c \ub4a4 \uc6b4\uc601 \ud658\uacbd\uc5d0 \ub9de\uac8c \uc801\uc6a9\ud574\uc57c \ud569\ub2c8\ub2e4.'
                  }
                </p>
              </div>
            </div>
          ) : null}

          {/* ── Severity 카드 ── */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {severityOrder.map((severity) => {
              const meta = severityMeta[severity];
              const count = counts[severity];
              return (
                <div
                  className="border border-neutral-100 bg-white px-5 py-4"
                  key={severity}
                  style={{ borderLeftColor: meta.bg, borderLeftWidth: '3px' }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: meta.bg }}>
                    {meta.label}
                  </span>
                  <div className={`mt-2 text-4xl font-black ${count === 0 ? 'text-neutral-200' : 'text-black'}`}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Checklist Progress ── */}
          <div className="border border-neutral-100 bg-white px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">Checklist Progress</p>
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
              <div className="w-full xl:max-w-sm">
                <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                  <span>진행률</span>
                  <span className="font-mono font-bold text-black">{resolvedRatio}%</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-[#9FCC2E] transition-all duration-500" style={{ width: `${resolvedRatio}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── 필터 ── */}
          <div className="border border-neutral-100 bg-white px-5 py-4">
            <div className="flex flex-col gap-3">
              {/* Severity */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Severity</span>
                <button
                  className={`border px-2.5 py-1 text-xs transition ${severityFilter === 'all' ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'}`}
                  onClick={() => setSeverityFilter('all')}
                  type="button"
                >
                  전체
                </button>
                {severityOrder.map((severity) => {
                  const active = severityFilter === severity;
                  return (
                    <button
                      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-bold transition ${active ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'}`}
                      key={severity}
                      onClick={() => setSeverityFilter(severity)}
                      type="button"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: active ? 'white' : severityMeta[severity].bg }} />
                      {severity}
                      <span className={`font-mono text-[11px] ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>{counts[severity]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Resolution */}
              <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                <span className="w-24 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Resolution</span>
                <button
                  className={`border px-2.5 py-1 text-xs transition ${resolutionFilter === 'all' ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'}`}
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
                      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-bold transition ${active ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'}`}
                      key={value}
                      onClick={() => setResolutionFilter(value)}
                      type="button"
                    >
                      <span className={`h-2 w-2 rounded-full ${active ? 'bg-white' : m.dot}`} />
                      {m.label}
                    </button>
                  );
                })}
                <div className="ml-auto flex flex-wrap items-center gap-3 font-mono text-[11px] text-neutral-400">
                  <span>Trivy {getSourceCount(summary, 'TRIVY')}</span>
                  <span>Custom {getSourceCount(summary, 'CUSTOM_RULE')}</span>
                  <span>AI {getSourceCount(summary, 'AI')}</span>
                </div>
              </div>
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
                    const serverDetail = currentScanType === 'SERVER_AUDIT' ? serverAuditDetails.get(finding.findingId) : null;
                    const serverRecommendation =
                      serverDetail?.fix?.summary ??
                      serverDetail?.fix?.recommendedActions?.join(' ') ??
                      serverDetail?.remediationGuide ??
                      null;

                    {
                      const findingUrl = ROUTES.resultFindingDetail
                        .replace(':scanId', String(finding.scanId))
                        .replace(':findingId', String(finding.findingId));
                      return (
                        <div
                          className={`group flex items-stretch border-b border-neutral-100 last:border-b-0 ${dimmed ? 'opacity-60' : ''}`}
                          key={finding.findingId}
                        >
                          <Link
                            className="flex flex-1 items-start gap-4 p-5 hover:bg-[#F5F5F5]"
                            state={{ ...routeState, initialView: 'explain' }}
                            to={findingUrl}
                          >
                            <div className="flex shrink-0 items-start pt-1">
                              <CheckCircle2 className={`h-5 w-5 ${dimmed ? 'text-emerald-500' : 'text-neutral-300'}`} />
                            </div>
                            <div className="w-1 self-stretch" style={{ background: severityMeta[finding.severity].bg }} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[11px] text-neutral-500">findingId #{finding.findingId}</span>
                                <span className="bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.2em]">{finding.category}</span>
                                {finding.sourceType && finding.sourceType !== finding.category ? (
                                  <span className="bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.2em]">{finding.sourceType}</span>
                                ) : null}
                                <span className="font-mono text-[10px] text-neutral-600">{finding.ruleCode}</span>
                                <span className={`ml-auto inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${resolutionMeta[finding.resolutionStatus].cls}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${resolutionMeta[finding.resolutionStatus].dot}`} />
                                  {resolutionMeta[finding.resolutionStatus].label}
                                </span>
                              </div>
                              <h3 className={`mt-3 text-base font-bold ${dimmed ? 'line-through' : ''}`}>{finding.title}</h3>
                              <div className="mt-2 font-mono text-xs text-neutral-500">{formatFindingLocation(finding)}</div>
                              {currentScanType === 'SERVER_AUDIT' ? (
                                <div className="mt-3 space-y-2">
                                  <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-6 text-neutral-700">
                                    <span className="mr-2 font-bold uppercase tracking-[0.16em] text-neutral-400">Evidence</span>
                                    <span className="font-mono">{serverDetail?.maskedEvidence ?? formatFindingLocation(finding)}</span>
                                  </div>
                                  {serverRecommendation ? (
                                    <div className="rounded border border-neutral-200 bg-white px-3 py-2 text-xs leading-6 text-neutral-700">
                                      <span className="mr-2 font-bold uppercase tracking-[0.16em] text-neutral-400">Recommendation</span>
                                      {serverRecommendation}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </Link>
                          {currentScanType !== 'SERVER_AUDIT' ? (
                            <div className="flex shrink-0 items-center border-l border-neutral-100 px-4">
                              <Link
                                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:border-black hover:bg-black hover:text-white"
                                state={{ ...routeState, initialView: 'apply' }}
                                to={findingUrl}
                              >
                                <Wrench className="h-3.5 w-3.5" />
                                고치기
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      );
                    }
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

          <ScanScopeInfo />
        </>
      ) : null}
    </section>
  );
}

export default ResultPage;
