import { ArrowLeft, FileText, GitBranch, RefreshCw, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { getScanStatus } from '../../features/scans/api/scans';
import ScanStatusBadge from '../../features/scans/components/ScanStatusBadge';
import { formatDateTime } from '../../features/scans/utils/scanPresentation';
import { severityMeta, showcaseFindings } from '../../mocks/ssaferShowcase';
import type { ScanProgressStatusData } from '../../types/scan';

type ResultRouteState = {
  projectId?: string;
};

function ResultPage() {
  const { scanId = '' } = useParams<{ scanId: string }>();
  const location = useLocation();
  const routeState = (location.state ?? {}) as ResultRouteState;

  const [statusData, setStatusData] = useState<ScanProgressStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | keyof typeof severityMeta>('all');
  const [resolutionFilter, setResolutionFilter] = useState<'all' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED'>('all');

  useEffect(() => {
    if (!scanId) {
      return;
    }

    let isMounted = true;

    const loadStatus = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getScanStatus(scanId);

        if (isMounted) {
          setStatusData(data);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : '스캔 결과 요약을 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadStatus();

    return () => {
      isMounted = false;
    };
  }, [scanId]);

  const findings = useMemo(
    () => showcaseFindings.filter((finding) => String(finding.scanId) === String(scanId || 1001)),
    [scanId],
  );

  const filteredFindings = findings.filter((finding) => {
    if (severityFilter !== 'all' && finding.severity !== severityFilter) {
      return false;
    }

    if (resolutionFilter !== 'all' && finding.resolutionStatus !== resolutionFilter) {
      return false;
    }

    return true;
  });

  const counts = findings.reduce(
    (accumulator, finding) => {
      accumulator[finding.severity] += 1;
      accumulator.total += 1;
      return accumulator;
    },
    { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0, total: 0 },
  );

  const resolutionCounts = findings.reduce(
    (accumulator, finding) => {
      accumulator[finding.resolutionStatus] += 1;
      return accumulator;
    },
    { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, IGNORED: 0 },
  );

  const actionableTotal = Math.max(findings.length - resolutionCounts.IGNORED, 1);
  const resolvedRatio = Math.round((resolutionCounts.RESOLVED / actionableTotal) * 100);

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className="inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-black"
          state={routeState}
          to={ROUTES.scanDetail.replace(':scanId', scanId)}
        >
          <ArrowLeft className="h-4 w-4" />
          스캔 진행 화면
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
            <button className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black" type="button">
              <RefreshCw className="h-4 w-4" />
              재분석
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
                <h2 className="mt-3 text-2xl font-black tracking-tight">shopping-mall-api</h2>
              </div>
              <PixelGoose mood={resolutionCounts.RESOLVED > 0 ? 'happy' : 'alert'} size={84} />
            </div>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              scanId #{scanId} · 상태 API는 실제 값을 사용하고, 상세 finding 리스트는 화면 프로토타입 형식으로 제공합니다.
            </p>
          </div>
        }
        description={
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
              <span className="font-mono">scanId #{scanId}</span>
              {statusData ? <ScanStatusBadge status={statusData.status} /> : null}
              <span>projectId #{routeState.projectId ?? '101'}</span>
            </div>
            <p className="text-neutral-600">
              {statusData?.completedAt
                ? `완료 시각: ${formatDateTime(statusData.completedAt)}`
                : '결과를 불러오는 중입니다.'}
            </p>
          </div>
        }
        eyebrow="SCAN RESULT"
        title="고칠 우선순위가 보이게 정리한 결과 화면"
      />

      {errorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <div className="border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-neutral-500">severity distribution</div>
          <div className="text-xs text-neutral-500">총 {counts.total}건</div>
        </div>
        <div className="mt-4 flex h-10 overflow-hidden">
          {(Object.keys(severityMeta) as Array<keyof typeof severityMeta>).map((severity) =>
            counts[severity] > 0 ? (
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
      </div>

      <div className="flex items-center justify-between border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-6">
          <PixelGoose mood={resolvedRatio > 30 ? 'happy' : 'working'} size={72} />
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-neutral-500">resolution progress</div>
            <div className="mt-2 text-3xl font-black">
              {resolutionCounts.RESOLVED}
              <span className="text-neutral-300"> / {actionableTotal}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-neutral-500">
              <span>OPEN {resolutionCounts.OPEN}</span>
              <span>IN_PROGRESS {resolutionCounts.IN_PROGRESS}</span>
              <span>RESOLVED {resolutionCounts.RESOLVED}</span>
              <span>IGNORED {resolutionCounts.IGNORED}</span>
            </div>
          </div>
        </div>
        <div className="ml-8 hidden flex-1 xl:block">
          <div className="h-3 bg-neutral-100">
            <div className="h-full bg-[#3DDC84]" style={{ width: `${resolvedRatio}%` }} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">severity</span>
        <button
          className={`border px-3 py-1.5 text-xs ${severityFilter === 'all' ? 'border-black bg-black text-white' : 'border-neutral-300 bg-white'}`}
          onClick={() => setSeverityFilter('all')}
          type="button"
        >
          전체
        </button>
        {(Object.keys(severityMeta) as Array<keyof typeof severityMeta>).map((severity) => (
          <button
            className={`border px-3 py-1.5 text-xs ${severityFilter === severity ? 'border-black bg-black text-white' : 'border-neutral-300 bg-white'}`}
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
        {(['all', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED'] as const).map((value) => (
          <button
            className={`border px-3 py-1.5 text-xs ${resolutionFilter === value ? 'border-black bg-black text-white' : 'border-neutral-300 bg-white'}`}
            key={value}
            onClick={() => setResolutionFilter(value)}
            type="button"
          >
            {value === 'all' ? '전체' : value}
          </button>
        ))}
      </div>

      <div className="border border-neutral-200 bg-white">
        {filteredFindings.map((finding) => {
          const dimmed = finding.resolutionStatus === 'RESOLVED' || finding.resolutionStatus === 'IGNORED';

          return (
            <Link
              className={`group flex items-start gap-4 border-b border-neutral-100 p-5 last:border-b-0 hover:bg-[#F5F5F5] ${dimmed ? 'opacity-60' : ''}`}
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
                  <span className="font-mono text-[11px] text-neutral-500">findingId #{finding.findingId}</span>
                  <span className="bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.2em]">
                    {finding.category}
                  </span>
                  <span className="bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.2em]">
                    {finding.sourceType}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-600">{finding.ruleCode}</span>
                </div>
                <h3 className={`mt-3 text-base font-bold ${dimmed ? 'line-through' : ''}`}>{finding.title}</h3>
                <div className="mt-2 font-mono text-xs text-neutral-500">
                  {finding.filePath}
                  {finding.lineNumber > 0 ? `:${finding.lineNumber}` : ''}
                </div>
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
      </div>
    </section>
  );
}

export default ResultPage;
