import { ArrowLeft, CheckCircle2, ChevronDown, FileText, GitBranch, RefreshCw, Wrench } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import { ROUTES } from '../../constants/routes';
import ScanScopeInfo from '../../features/results/components/ScanScopeInfo';
import useResultPageData from '../../features/results/hooks/useResultPageData';
import {
  formatFindingLocation,
  getSourceCount,
  hasApplicablePatchPayload,
  resolutionMeta,
  resolutionValues,
  severityMeta,
  severityOrder,
} from '../../features/results/utils/resultPresentation';
import ScanModeBadge from '../../features/scans/components/ScanModeBadge';
import ScanStatusBadge from '../../features/scans/components/ScanStatusBadge';
import ScanTypeBadge from '../../features/scans/components/ScanTypeBadge';
import { formatDateTime } from '../../features/scans/utils/scanPresentation';
import type { FindingResolutionStatus } from '../../types/scan';

type ResultRouteState = {
  projectId?: string;
};

function ResultPage() {
  const { scanId = '' } = useParams<{ scanId: string }>();
  const location = useLocation();
  const routeState = (location.state ?? {}) as ResultRouteState;

  const {
    clearResolutionFilter,
    clearSeverityFilter,
    counts,
    currentProjectId,
    currentScanType,
    errorMessage,
    expandedFindingGroups,
    findingsData,
    goToNextPage,
    goToPreviousPage,
    groupedFindings,
    handleResolutionStatusChange,
    ignoredCount,
    inProgressCount,
    isFindingsLoading,
    isInitialLoading,
    isServerAudit,
    openCount,
    page,
    projectName,
    refreshOverview,
    resolutionFilter,
    resolvedCount,
    resolvedRatio,
    scanBasic,
    serverAuditDetails,
    setResolutionFilter,
    setSeverityFilter,
    severityFilter,
    summary,
    toggleFindingGroup,
    updatingStatusFindingIds,
  } = useResultPageData(scanId, routeState);

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
          Back to project
        </Link>
      </div>

      <section className="overflow-hidden border border-neutral-200 bg-white">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="px-6 py-8 md:px-8">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.32em] text-neutral-400">SCAN RESULT</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight text-black md:text-5xl">
                {isServerAudit ? 'Server audit result' : 'Scan result'}
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
                  {scanBasic?.completedAt ? formatDateTime(scanBasic.completedAt) : 'Not completed yet'}
                </p>
              </div>
              <div className="border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">Action Needed</p>
                <p className="mt-1 font-bold text-neutral-900">
                  {openCount + inProgressCount}
                  <span className="ml-2 font-normal text-neutral-500">open + in progress</span>
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              <Link
                className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
                to={ROUTES.history}
              >
                <GitBranch className="h-4 w-4" />
                Compare results
              </Link>
              <button
                className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
                onClick={() => void refreshOverview()}
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                className="inline-flex items-center gap-2 border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-400"
                disabled
                type="button"
              >
                <FileText className="h-4 w-4" />
                Export coming soon
              </button>
            </div>
          </div>

          <aside className="border-t border-neutral-100 bg-neutral-50 p-6 xl:border-l xl:border-t-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">SUMMARY</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-neutral-500">Total</p>
                <p className="mt-1 text-3xl font-black text-black">{summary?.totalFindings ?? 0}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-neutral-500">Critical</p>
                <p className="mt-1 text-3xl font-black text-[#E63946]">{counts.CRITICAL}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-neutral-500">Resolved</p>
                <p className="mt-1 text-3xl font-black text-[#4A7A00]">{resolvedCount}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-neutral-500">Ignored</p>
                <p className="mt-1 text-3xl font-black text-neutral-400">{ignoredCount}</p>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                <span>Resolved ratio</span>
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
        <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">
          Loading scan result...
        </div>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-5">
              <div className="border border-neutral-100 bg-white px-5 py-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400">Overview</p>
                    <h2 className="mt-2 text-2xl font-black text-black">
                      {summary?.totalFindings ?? 0}
                      <span className="ml-2 text-base text-neutral-300">findings</span>
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400">Resolved</p>
                    <p className="mt-2 text-2xl font-black text-black">
                      {resolvedCount}
                      <span className="text-neutral-300"> / {Math.max((summary?.totalFindings ?? 0) - ignoredCount, 1)}</span>
                    </p>
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
                        <span
                          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em]"
                          style={{ color: severityFilter === severity ? 'white' : meta.bg }}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: severityFilter === severity ? 'white' : meta.bg }}
                          />
                          {meta.label}
                        </span>
                        <span className={`mt-2 block text-3xl font-black ${count === 0 && severityFilter !== severity ? 'text-neutral-200' : ''}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border border-neutral-100 bg-white px-5 py-5">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-neutral-700">Resolution progress</span>
                  <span className="font-mono font-black text-black">{resolvedRatio}%</span>
                </div>
                <div className="h-2 bg-neutral-100">
                  <div className="h-full bg-[#9FCC2E] transition-all duration-500" style={{ width: `${resolvedRatio}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {resolutionValues.map((value) => {
                    const meta = resolutionMeta[value];
                    const count = summary?.resolutionCounts?.[value] ?? 0;
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
                          <span className={`h-1.5 w-1.5 rounded-full ${resolutionFilter === value ? 'bg-white' : meta.dot}`} />
                          {meta.label}
                        </span>
                        <span className="font-mono">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border border-neutral-100 bg-white px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Filter</span>
                  <button
                    className={`border px-3 py-1.5 text-xs font-bold transition ${
                      severityFilter === 'all' ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
                    }`}
                    onClick={clearSeverityFilter}
                    type="button"
                  >
                    All severities
                  </button>
                  <button
                    className={`border px-3 py-1.5 text-xs font-bold transition ${
                      resolutionFilter === 'all' ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
                    }`}
                    onClick={clearResolutionFilter}
                    type="button"
                  >
                    All statuses
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
                  <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">
                    Loading findings...
                  </div>
                ) : groupedFindings.length === 0 ? (
                  <div className="border border-neutral-200 bg-white px-5 py-12 text-center text-sm text-neutral-500">
                    No findings match the current filters.
                  </div>
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
                            <span className="text-sm font-bold">
                              {group.severity} {group.items.length}
                            </span>
                          </div>
                          <span className="text-xs text-neutral-500">
                            {shouldCollapseSeverity ? (severityExpanded ? 'Collapse' : 'Expand') : 'Single item'}
                          </span>
                        </button>

                        {severityExpanded
                          ? group.titleGroups.map((titleGroup) => {
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
                                          <span className="rounded-full bg-black px-2.5 py-1 text-xs font-black text-white">
                                            Related {titleGroup.items.length}
                                          </span>
                                          <span className="font-mono text-[11px] text-neutral-500">
                                            findingId #{titleGroup.items.map((item) => item.findingId).join(', #')}
                                          </span>
                                        </div>
                                        <div className="mt-2 truncate text-base font-black text-black">{titleGroup.title}</div>
                                      </div>
                                      <span className="hidden text-xs font-bold text-neutral-500 sm:inline">
                                        {titleExpanded ? 'Collapse' : 'Expand'}
                                      </span>
                                    </button>
                                  ) : null}

                                  {visibleItems.map((finding) => {
                                    const dimmed =
                                      finding.resolutionStatus === 'RESOLVED' || finding.resolutionStatus === 'IGNORED';
                                    const serverDetail =
                                      currentScanType === 'SERVER_AUDIT' ? serverAuditDetails.get(finding.findingId) : null;
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
                                            Status
                                            <select
                                              className="w-28 rounded-full border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-bold normal-case tracking-normal text-neutral-700 disabled:cursor-wait disabled:opacity-50"
                                              disabled={updatingStatusFindingIds.includes(finding.findingId)}
                                              onChange={(event) => {
                                                void handleResolutionStatusChange(
                                                  finding,
                                                  event.target.value as FindingResolutionStatus,
                                                );
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
                                              Apply view
                                            </Link>
                                          ) : null}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })
                          : null}
                      </section>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-500">
                <span>
                  Total {findingsData.totalElements} items, showing{' '}
                  {findingsData.totalElements === 0 ? 0 : page * findingsData.size + 1}-
                  {Math.min((page + 1) * findingsData.size, findingsData.totalElements)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="border border-neutral-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={page <= 0}
                    onClick={goToPreviousPage}
                    type="button"
                  >
                    Prev
                  </button>
                  <span className="font-mono text-xs">
                    {findingsData.totalPages === 0 ? 0 : page + 1} / {findingsData.totalPages}
                  </span>
                  <button
                    className="border border-neutral-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={findingsData.totalPages === 0 || page >= findingsData.totalPages - 1}
                    onClick={goToNextPage}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>

              <ScanScopeInfo />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default ResultPage;
