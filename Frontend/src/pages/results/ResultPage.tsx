import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, FileText, GitBranch, RefreshCw, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import { ROUTES } from '../../constants/routes';
import { useToast } from '../../features/feedback/useToast';
import { getProjectDetail } from '../../features/projects/api/projects';
import { getScanBasic, getScanFindingDetail, getScanFindings, getScanSummary, updateFindingResolutionStatus } from '../../features/results/api/results';
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
  OPEN: { label: '미해결', cls: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-400' },
  IN_PROGRESS: { label: '처리 중', cls: 'border border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
  RESOLVED: { label: '해결 완료', cls: 'bg-[#EDFFC0] text-[#4A7A00]', dot: 'bg-[#9FCC2E]' },
  IGNORED: { label: '무시됨', cls: 'bg-neutral-100 text-neutral-400', dot: 'bg-neutral-300' },
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

function getFindingTitleGroupKey(title: string) {
  return (title.trim() || '제목 없는 취약점')
    .replace(/포트\(\d+\)/g, '포트(*)')
    .replace(/\(\d+\)/g, '(*)')
    .replace(/\b\d{2,5}\b/g, '*');
}
function groupFindingsByTitle(findings: ScanFindingListItemData[]) {
  const groups = new Map<string, { title: string; items: ScanFindingListItemData[] }>();

  findings.forEach((finding) => {
    const key = getFindingTitleGroupKey(finding.title);
    const group = groups.get(key) ?? { title: key, items: [] };
    group.items.push(finding);
    groups.set(key, group);
  });

  return Array.from(groups.values());
}

function hasApplicablePatchPayload(finding: ScanFindingDetailData | undefined) {
  if (!finding?.patchPayloadJson) {
    return false;
  }

  return Boolean(
    finding.fix?.patches?.some((patch) => {
      return Boolean(patch.filePath && patch.operation);
    }),
  );
}

function ResultPage() {
  const { scanId = '' } = useParams<{ scanId: string }>();
  const location = useLocation();
  const routeState = (location.state ?? {}) as ResultRouteState;
  const toast = useToast();

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
  const [expandedFindingGroups, setExpandedFindingGroups] = useState<Set<string>>(new Set());
  const [updatingStatusFindingIds, setUpdatingStatusFindingIds] = useState<number[]>([]);

  useEffect(() => {
    setPage(0);
  }, [severityFilter, resolutionFilter, scanId]);

  useEffect(() => {
    setExpandedFindingGroups(new Set());
  }, [scanId, page, severityFilter, resolutionFilter]);

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

        // 프로젝트 이름을 함께 표시하기 위해 상세 정보를 보강한다.
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

  // Finding 상세를 함께 가져와 서버 점검 evidence와 자동 수정 가능 여부를 표시한다.
  useEffect(() => {
    if (!scanId || findingsData.items.length === 0) {
      setServerAuditDetails(new Map());
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
  const openCount = getResolutionCount(summary, 'OPEN');
  const inProgressCount = getResolutionCount(summary, 'IN_PROGRESS');
  const ignoredCount = getResolutionCount(summary, 'IGNORED');
  const resolvedRatio = Math.round((resolvedCount / actionableTotal) * 100);
  const routeProjectId = routeState.projectId ? Number(routeState.projectId) : undefined;
  const currentProjectId = scanBasic?.projectId ?? routeProjectId;
  const currentScanType = getSafeScanType(scanBasic?.scanType);
  const isServerAudit = currentScanType === 'SERVER_AUDIT';

  const groupedFindings = useMemo(() => {
    return severityOrder
      .map((severity) => ({
        severity,
        items: findingsData.items.filter((finding) => finding.severity === severity),
      }))
      .map((group) => ({
        ...group,
        titleGroups: groupFindingsByTitle(group.items),
      }))
      .filter((group) => group.items.length > 0);
  }, [findingsData.items]);

  const toggleFindingGroup = (groupKey: string) => {
    setExpandedFindingGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const handleResolutionStatusChange = async (
    finding: ScanFindingListItemData,
    nextStatus: FindingResolutionStatus,
  ) => {
    if (finding.resolutionStatus === nextStatus || updatingStatusFindingIds.includes(finding.findingId)) {
      return;
    }

    const previousStatus = finding.resolutionStatus;
    setUpdatingStatusFindingIds((current) => [...current, finding.findingId]);

    try {
      await updateFindingResolutionStatus(finding.findingId, nextStatus);
      setFindingsData((current) => ({
        ...current,
        items: current.items
          .map((item) =>
            item.findingId === finding.findingId ? { ...item, resolutionStatus: nextStatus } : item,
          )
          .filter((item) => resolutionFilter === 'all' || item.resolutionStatus === resolutionFilter),
      }));
      setSummary((current) => {
        if (!current) return current;
        return {
          ...current,
          resolutionCounts: {
            ...current.resolutionCounts,
            [previousStatus]: Math.max((current.resolutionCounts?.[previousStatus] ?? 0) - 1, 0),
            [nextStatus]: (current.resolutionCounts?.[nextStatus] ?? 0) + 1,
          },
        };
      });
      toast.success('탐지 결과 상태를 변경했습니다.', { durationMs: 2000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : '탐지 결과 상태를 변경하지 못했습니다.';
      toast.error(message, { durationMs: 2500 });
    } finally {
      setUpdatingStatusFindingIds((current) => current.filter((id) => id !== finding.findingId));
    }
  };

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

      <section className="overflow-hidden border border-neutral-200 bg-white">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="px-6 py-8 md:px-8">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.32em] text-neutral-400">SCAN RESULT</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight text-black md:text-5xl">
                {isServerAudit ? '서버 점검 결과' : '스캔 결과'}
              </h1>
              <span className="rounded-full bg-black px-3 py-1 font-mono text-xs font-bold text-white">#{scanId}</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {currentProjectId ? (
                <Link
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-bold text-black transition hover:border-black"
                  state={routeState}
                  to={ROUTES.projectDetail.replace(':projectId', String(currentProjectId))}
                >
                  {projectName ?? `Project #${currentProjectId}`}
                  <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                </Link>
              ) : null}
              {scanBasic ? <ScanStatusBadge status={scanBasic.status} /> : null}
              {scanBasic ? <ScanTypeBadge scanType={scanBasic.scanType} /> : null}
              {scanBasic ? <ScanModeBadge scanMode={scanBasic.scanMode} source={scanBasic.source} /> : null}
            </div>

            <div className="mt-6 grid gap-3 text-sm text-neutral-600 sm:grid-cols-2 xl:max-w-3xl">
              <div className="border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">Completed</p>
                <p className="mt-1 font-bold text-neutral-900">
                  {scanBasic?.completedAt ? formatDateTime(scanBasic.completedAt) : '분석 대기 중'}
                </p>
              </div>
              <div className="border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">Action Needed</p>
                <p className="mt-1 font-bold text-neutral-900">
                  {openCount + inProgressCount}건
                  <span className="ml-2 font-normal text-neutral-500">미해결/처리 중</span>
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              <Link
                className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
                to={ROUTES.history}
              >
                <GitBranch className="h-4 w-4" />
                결과 비교
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
                className="inline-flex items-center gap-2 border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-400"
                disabled
                type="button"
              >
                <FileText className="h-4 w-4" />
                내보내기 준비 중
              </button>
            </div>
          </div>

          <aside className="border-t border-neutral-100 bg-neutral-50 p-6 xl:border-l xl:border-t-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">SUMMARY</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-neutral-500">총 탐지</p>
                <p className="mt-1 text-3xl font-black text-black">{summary?.totalFindings ?? 0}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-neutral-500">Critical</p>
                <p className="mt-1 text-3xl font-black text-[#E63946]">{counts.CRITICAL}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-neutral-500">해결 완료</p>
                <p className="mt-1 text-3xl font-black text-[#4A7A00]">{resolvedCount}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-neutral-500">무시됨</p>
                <p className="mt-1 text-3xl font-black text-neutral-400">{ignoredCount}</p>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                <span>해결 진행률</span>
                <span className="font-mono font-bold text-black">{resolvedRatio}%</span>
              </div>
              <div className="h-2 bg-neutral-200">
                <div className="h-full bg-[#9FCC2E] transition-all duration-500" style={{ width: `${resolvedRatio}%` }} />
              </div>
            </div>
          </aside>
        </div>
      </section>
      {errorMessage ? <PageBanner message={errorMessage} tone="error" /> : null}

      {isInitialLoading ? (
        <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">스캔 결과를 불러오는 중입니다.</div>
      ) : null}

      {!isInitialLoading && summary ? (
        <>
          {isServerAudit ? (
            <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-black text-amber-950">서버 런타임 점검 결과입니다.</p>
                <p>
                  실행 중인 서버의 포트, Docker publish, 방화벽, SSH, nginx, 프로세스 상태를 기준으로 판단합니다.
                  sudo 권한이나 OS package scan 옵션에 따라 일부 점검은 제한될 수 있습니다.
                </p>
                <p className="mt-2 font-bold text-amber-950">
                  서버 점검은 운영 환경의 현재 상태를 보는 결과라 자동 코드 패치 대상이 아닙니다. 권장 조치를 확인한 뒤 운영 영향도를 보고 적용해야 합니다.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="border border-neutral-100 bg-white px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">Severity Overview</p>
                  <p className="mt-1 text-sm text-neutral-500">위험도별 탐지 수와 조치 상태를 한 번에 확인합니다.</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">Resolved</p>
                  <p className="mt-1 text-2xl font-black text-black">{resolvedCount}<span className="text-neutral-300"> / {actionableTotal}</span></p>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {severityOrder.map((severity) => {
                  const meta = severityMeta[severity];
                  const count = counts[severity];
                  return (
                    <button
                      className={`border px-4 py-3 text-left transition ${
                        severityFilter === severity
                          ? 'border-black bg-black text-white'
                          : 'border-neutral-200 bg-white hover:border-neutral-400'
                      }`}
                      key={severity}
                      onClick={() => setSeverityFilter(severity)}
                      type="button"
                    >
                      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: severityFilter === severity ? 'white' : meta.bg }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: severityFilter === severity ? 'white' : meta.bg }} />
                        {meta.label}
                      </span>
                      <span className={`mt-2 block text-3xl font-black ${count === 0 && severityFilter !== severity ? 'text-neutral-200' : ''}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border border-neutral-100 bg-white px-5 py-5">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-bold text-neutral-700">체크리스트 진행률</span>
                <span className="font-mono font-black text-black">{resolvedRatio}%</span>
              </div>
              <div className="h-2 bg-neutral-100">
                <div className="h-full bg-[#9FCC2E] transition-all duration-500" style={{ width: `${resolvedRatio}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {resolutionValues.map((value) => {
                  const m = resolutionMeta[value];
                  const cnt = getResolutionCount(summary, value);
                  return (
                    <button
                      className={`inline-flex items-center justify-between gap-2 border px-3 py-2 text-xs font-bold transition ${
                        resolutionFilter === value
                          ? 'border-black bg-black text-white'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
                      }`}
                      key={value}
                      onClick={() => setResolutionFilter(value)}
                      type="button"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${resolutionFilter === value ? 'bg-white' : m.dot}`} />
                        {m.label}
                      </span>
                      <span className="font-mono">{cnt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border border-neutral-100 bg-white px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Filter</span>
              <button
                className={`border px-3 py-1.5 text-xs font-bold transition ${severityFilter === 'all' ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'}`}
                onClick={() => setSeverityFilter('all')}
                type="button"
              >
                모든 위험도
              </button>
              <button
                className={`border px-3 py-1.5 text-xs font-bold transition ${resolutionFilter === 'all' ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'}`}
                onClick={() => setResolutionFilter('all')}
                type="button"
              >
                모든 상태
              </button>
              <div className="ml-auto flex flex-wrap items-center gap-3 font-mono text-[11px] text-neutral-400">
                <span>Trivy {getSourceCount(summary, 'TRIVY')}</span>
                <span>Custom {getSourceCount(summary, 'CUSTOM_RULE')}</span>
                <span>AI {getSourceCount(summary, 'AI')}</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {isFindingsLoading ? (
              <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">탐지 항목을 불러오는 중입니다.</div>
            ) : groupedFindings.length === 0 ? (
              <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">조건에 맞는 탐지 항목이 없습니다.</div>
            ) : (
              groupedFindings.map((group) => {
                const severityGroupKey = `severity:${group.severity}`;
                const shouldCollapseSeverity = group.items.length > 1;
                const severityExpanded = !shouldCollapseSeverity || expandedFindingGroups.has(severityGroupKey);
                const shouldGroupByTitle = group.titleGroups.length > 1;

                return (
                  <section className="border border-neutral-200 bg-white" key={group.severity}>
                    <button
                      aria-expanded={severityExpanded}
                      className={`flex w-full items-center justify-between border-b border-neutral-100 px-5 py-4 text-left ${
                        shouldCollapseSeverity ? 'transition hover:bg-neutral-50' : 'cursor-default'
                      }`}
                      disabled={!shouldCollapseSeverity}
                      onClick={() => {
                        if (shouldCollapseSeverity) {
                          toggleFindingGroup(severityGroupKey);
                        }
                      }}
                      type="button"
                    >
                      <div className="flex items-center gap-3">
                        {shouldCollapseSeverity ? (
                          <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${severityExpanded ? 'rotate-180' : ''}`} />
                        ) : null}
                        <span
                          className="px-2 py-1 text-[10px] font-bold tracking-[0.22em]"
                          style={{ background: severityMeta[group.severity].bg, color: severityMeta[group.severity].fg }}
                        >
                          {group.severity}
                        </span>
                        <span className="text-sm font-bold">{group.severity} · {group.items.length}건</span>
                      </div>
                      <span className="text-xs text-neutral-500">
                        {shouldCollapseSeverity ? (severityExpanded ? '접기' : '펼쳐보기') : '위험도가 높은 항목부터 확인해 보세요.'}
                      </span>
                    </button>

                    {severityExpanded ? group.titleGroups.map((titleGroup) => {
                      const groupKey = `${group.severity}:${titleGroup.title}`;
                      const shouldCollapseTitle = shouldGroupByTitle && titleGroup.items.length > 1;
                      const titleExpanded = !shouldCollapseTitle || expandedFindingGroups.has(groupKey);
                      const visibleItems = titleExpanded ? titleGroup.items : [];

                    return (
                      <div className="border-b border-neutral-100 last:border-b-0" key={groupKey}>
                        {shouldCollapseTitle ? (
                          <button
                            aria-expanded={titleExpanded}
                            className="flex w-full items-center gap-4 bg-neutral-50 px-5 py-4 text-left transition hover:bg-neutral-100"
                            onClick={() => toggleFindingGroup(groupKey)}
                            type="button"
                          >
                            <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${titleExpanded ? 'rotate-180' : ''}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-black px-2.5 py-1 text-xs font-black text-white">동일 유형 {titleGroup.items.length}건</span>
                                <span className="font-mono text-[11px] text-neutral-500">
                                  findingId #{titleGroup.items.map((item) => item.findingId).join(', #')}
                                </span>
                              </div>
                              <div className="mt-2 truncate text-base font-black text-black">{titleGroup.title}</div>
                            </div>
                            <span className="hidden text-xs font-bold text-neutral-500 sm:inline">
                              {titleExpanded ? '접기' : '펼쳐보기'}
                            </span>
                          </button>
                        ) : null}
                        {visibleItems.map((finding) => {
                          const dimmed = finding.resolutionStatus === 'RESOLVED' || finding.resolutionStatus === 'IGNORED';
                          const serverDetail = currentScanType === 'SERVER_AUDIT' ? serverAuditDetails.get(finding.findingId) : null;
                          const findingDetail = serverAuditDetails.get(finding.findingId);
                          const hasApplicablePatch =
                            currentScanType !== 'SERVER_AUDIT' &&
                            hasApplicablePatchPayload(findingDetail);
                          const serverRecommendation =
                            serverDetail?.fix?.summary ??
                            serverDetail?.fix?.recommendedActions?.join(' ') ??
                            serverDetail?.remediationGuide ??
                            null;
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
                              <div className="flex shrink-0 flex-col items-center justify-center gap-2 border-l border-neutral-100 px-4">
                                <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                                  상태
                                  <select
                                    className="w-28 rounded-full border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-bold normal-case tracking-normal text-neutral-700 disabled:cursor-wait disabled:opacity-50"
                                    disabled={updatingStatusFindingIds.includes(finding.findingId)}
                                    onChange={(event) => {
                                      void handleResolutionStatusChange(finding, event.target.value as FindingResolutionStatus);
                                    }}
                                    onClick={(event) => event.stopPropagation()}
                                    value={finding.resolutionStatus}
                                  >
                                    {resolutionValues.map((value) => (
                                      <option key={value} value={value}>
                                        {resolutionMeta[value].label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                {hasApplicablePatch ? (
                                  <Link
                                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:border-black hover:bg-black hover:text-white"
                                    state={{ ...routeState, initialView: 'apply' }}
                                    to={findingUrl}
                                  >
                                    <Wrench className="h-3.5 w-3.5" />
                                    고치기
                                  </Link>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                    }) : null}
                  </section>
                );
              })
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
