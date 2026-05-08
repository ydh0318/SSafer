import { ArrowLeft, FileText, GitBranch, RefreshCw, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import ServerAuditResultView from '../../features/results/components/ServerAuditResultView';
import {
  getScanBasic,
  getScanFindings,
  getScanSummary,
} from '../../features/results/api/results';
import ScanStatusBadge from '../../features/scans/components/ScanStatusBadge';
import ScanTypeBadge from '../../features/scans/components/ScanTypeBadge';
import { formatDateTime, getSafeScanType, getScanModeLabel, getScanTypeLabel } from '../../features/scans/utils/scanPresentation';
import { buildMockServerAuditResult } from '../../mocks/serverAudit';
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

const severityMeta: Record<
  FindingSeverity,
  { bg: string; fg: string; soft: string; label: string }
> = {
  CRITICAL: { bg: '#E63946', fg: '#FFFFFF', soft: '#FFE5E5', label: 'CRITICAL' },
  HIGH: { bg: '#FF8A33', fg: '#FFFFFF', soft: '#FFF1E5', label: 'HIGH' },
  MEDIUM: { bg: '#FFB627', fg: '#111111', soft: '#FFF9DB', label: 'MEDIUM' },
  LOW: { bg: '#3D5AFE', fg: '#FFFFFF', soft: '#E5EBFF', label: 'LOW' },
  INFO: { bg: '#9CA3AF', fg: '#FFFFFF', soft: '#F3F4F6', label: 'INFO' },
};

const resolutionValues = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED'] as const;

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
  const target = finding.filePath || finding.resourceName || '경로 정보 없음';

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
  const [serverAuditResult, setServerAuditResult] = useState<ServerAuditResultViewModel | null>(null);
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

        if (getSafeScanType(basicData.scanType) === 'SERVER_AUDIT') {
          setSummary(null);
          setServerAuditResult(buildMockServerAuditResult(basicData));
          return;
        }

        const summaryData = await getScanSummary(scanId);

        if (!isMounted) {
          return;
        }

        setSummary(summaryData);
        setServerAuditResult(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : '스캔 결과 정보를 불러오지 못했습니다.');
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
        if (getSafeScanType(scanBasic?.scanType) === 'SERVER_AUDIT') {
          if (!isMounted) {
            return;
          }

          setFindingsData(emptyFindingList);
          return;
        }

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

        setErrorMessage(error instanceof Error ? error.message : '스캔 결과 목록을 불러오지 못했습니다.');
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

  const actionableTotal = Math.max(
    (summary?.totalFindings ?? 0) - getResolutionCount(summary, 'IGNORED'),
    1,
  );
  const resolvedCount = getResolutionCount(summary, 'RESOLVED');
  const resolvedRatio = Math.round((resolvedCount / actionableTotal) * 100);
  const routeProjectId = routeState.projectId ? Number(routeState.projectId) : undefined;
  const currentProjectId = scanBasic?.projectId ?? routeProjectId;
  const currentScanType = getSafeScanType(scanBasic?.scanType);

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className="inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-black"
          state={routeState}
          to={ROUTES.scanDetail.replace(':scanId', scanId)}
        >
          <ArrowLeft className="h-4 w-4" />
          스캔 상세로 돌아가기
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
              이전 스캔과 비교
            </Link>
            <button
              className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
              onClick={() => {
                if (!scanId) {
                  return;
                }

                void getScanBasic(scanId).then((basicData) => {
                  setScanBasic(basicData);

                  if (getSafeScanType(basicData.scanType) === 'SERVER_AUDIT') {
                    setSummary(null);
                    setServerAuditResult(buildMockServerAuditResult(basicData));
                    return;
                  }

                  void getScanSummary(scanId).then((summaryData) => {
                    setSummary(summaryData);
                    setServerAuditResult(null);
                  });
                });
              }}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              새로고침
            </button>
            <button className="inline-flex items-center gap-2 bg-black px-4 py-2 text-sm font-bold text-white" type="button">
              <FileText className="h-4 w-4" />
              리포트
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
              실제 스캔 결과 요약과 finding 목록을 기반으로 현재 위험도, 조치 상태, 탐지 출처를 한 번에 확인할 수 있습니다.
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
                {scanBasic ? <span>{getScanModeLabel(scanBasic.scanMode)}</span> : null}
              </div>
              <p className="text-neutral-600">
                {scanBasic?.completedAt
                ? `완료 시각: ${formatDateTime(scanBasic.completedAt)}`
                : '아직 완료되지 않은 스캔입니다. 진행 중이라면 목록이 부분적으로 보일 수 있습니다.'}
            </p>
          </div>
        }
        eyebrow="SCAN RESULT"
        title={
          currentScanType === 'SERVER_AUDIT'
            ? '서버 점검 결과와 운영 조치 안내'
            : '스캔 결과 요약과 취약점 목록'
        }
      />

      {errorMessage ? <PageBanner message={errorMessage} tone="error" /> : null}

      {isInitialLoading ? (
        <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">
          스캔 결과 정보를 불러오는 중입니다.
        </div>
      ) : null}

      {!isInitialLoading && currentScanType === 'SERVER_AUDIT' && scanBasic && serverAuditResult ? (
        <ServerAuditResultView result={serverAuditResult} routeState={routeState} />
      ) : null}

      {!isInitialLoading && currentScanType === 'PROJECT_SCAN' && summary ? (
        <>
          <div className="border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-neutral-500">severity distribution</div>
              <div className="text-xs text-neutral-500">총 {counts.total}건</div>
            </div>
            <div className="mt-4 flex h-10 overflow-hidden">
              {(Object.keys(severityMeta) as FindingSeverity[]).map((severity) =>
                counts[severity] > 0 && counts.total > 0 ? (
                  <div
                    className="flex items-center justify-center text-xs font-bold"
                    key={severity}
                    style={{
                      background: severityMeta[severity].bg,
                      color: severityMeta[severity].fg,
                      width: `${(counts[severity] / counts.total) * 100}%`,
                    }}
                  >
                    {severity[0]}
                    {counts[severity]}
                  </div>
                ) : null,
              )}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-5">
              {(Object.keys(severityMeta) as FindingSeverity[]).map((severity) => (
                <div className="flex items-center gap-2 text-xs" key={severity}>
                  <span className="h-2 w-2 rounded-full" style={{ background: severityMeta[severity].bg }} />
                  <span className="text-neutral-600">{severity}</span>
                  <span className="ml-auto font-bold">{counts[severity]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6 border border-neutral-200 bg-white p-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-6">
              <PixelGoose mood={resolvedRatio > 30 ? 'happy' : 'working'} size={72} />
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.28em] text-neutral-500">resolution progress</div>
                <div className="mt-2 text-3xl font-black">
                  {resolvedCount}
                  <span className="text-neutral-300"> / {actionableTotal}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-neutral-500">
                  {resolutionValues.map((value) => (
                    <span key={value}>
                      {value} {getResolutionCount(summary, value)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="w-full xl:max-w-[420px]">
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
            {(Object.keys(severityMeta) as FindingSeverity[]).map((severity) => (
              <button
                className={`border px-3 py-1.5 text-xs ${
                  severityFilter === severity ? 'border-black bg-black text-white' : 'border-neutral-300 bg-white'
                }`}
                key={severity}
                onClick={() => setSeverityFilter(severity)}
                type="button"
              >
                {severity} {counts[severity]}
              </button>
            ))}
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
            {resolutionValues.map((value) => (
              <button
                className={`border px-3 py-1.5 text-xs ${
                  resolutionFilter === value ? 'border-black bg-black text-white' : 'border-neutral-300 bg-white'
                }`}
                key={value}
                onClick={() => setResolutionFilter(value)}
                type="button"
              >
                {value}
              </button>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <span>TRIVY {getSourceCount(summary, 'TRIVY')}</span>
              <span>CUSTOM_RULE {getSourceCount(summary, 'CUSTOM_RULE')}</span>
              <span>AI {getSourceCount(summary, 'AI')}</span>
            </div>
          </div>

          <div className="border border-neutral-200 bg-white">
            {isFindingsLoading ? (
              <div className="px-5 py-12 text-center text-sm text-neutral-500">finding 목록을 불러오는 중입니다.</div>
            ) : findingsData.items.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-neutral-500">조건에 맞는 finding이 없습니다.</div>
            ) : (
              findingsData.items.map((finding) => {
                const dimmed =
                  finding.resolutionStatus === 'RESOLVED' || finding.resolutionStatus === 'IGNORED';

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
                    <div className="w-1 self-stretch" style={{ background: severityMeta[finding.severity].bg }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="px-2 py-0.5 text-[10px] font-bold tracking-[0.22em]"
                          style={{
                            background: severityMeta[finding.severity].bg,
                            color: severityMeta[finding.severity].fg,
                          }}
                        >
                          {finding.severity}
                        </span>
                        <span className="font-mono text-[11px] text-neutral-500">
                          findingId #{finding.findingId}
                        </span>
                        <span className="bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.2em]">
                          {finding.category}
                        </span>
                        <span className="bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.2em]">
                          {finding.sourceType}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-600">{finding.ruleCode}</span>
                        <span className="ml-auto text-[10px] font-bold tracking-[0.2em] text-neutral-500">
                          {finding.resolutionStatus}
                        </span>
                      </div>
                      <h3 className={`mt-3 text-base font-bold ${dimmed ? 'line-through' : ''}`}>{finding.title}</h3>
                      <div className="mt-2 font-mono text-xs text-neutral-500">{formatFindingLocation(finding)}</div>
                    </div>
                    {!dimmed ? (
                      <span className="inline-flex items-center gap-1 bg-black px-3 py-1.5 text-xs font-bold text-white transition group-hover:bg-[#3DDC84] group-hover:text-black">
                        <Wand2 className="h-3 w-3" />
                        자세히 보기
                      </span>
                    ) : null}
                  </Link>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-500">
            <span>
              총 {findingsData.totalElements}건 중 {findingsData.totalElements === 0 ? 0 : page * findingsData.size + 1}
              -
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
