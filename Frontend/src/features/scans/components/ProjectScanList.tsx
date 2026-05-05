import { Link } from 'react-router-dom';

import SectionPanel from '../../../components/common/SectionPanel';
import { ROUTES } from '../../../constants/routes';
import type { ProjectScanListItemData, ProjectScanListQuery, ScanMode, ScanStatus } from '../../../types/scan';
import { formatCompactDateTime, getScanModeLabel } from '../utils/scanPresentation';
import ScanStatusBadge from './ScanStatusBadge';

const scanStatuses: Array<ScanStatus> = [
  'REQUESTED',
  'QUEUED',
  'RUNNING',
  'RAW_UPLOADED',
  'DONE',
  'FAILED',
  'CANCELED',
];

const scanModes: Array<ScanMode> = ['AGENT', 'UPLOAD'];

type ProjectScanListProps = {
  projectId: string;
  scans: ProjectScanListItemData[];
  filters: ProjectScanListQuery;
  isLoading: boolean;
  errorMessage: string | null;
  onFilterChange: (nextValue: ProjectScanListQuery) => void;
  onRefresh: () => void;
};

function ProjectScanList({
  projectId,
  scans,
  filters,
  isLoading,
  errorMessage,
  onFilterChange,
  onRefresh,
}: ProjectScanListProps) {
  return (
    <SectionPanel
      action={
        <button
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          onClick={onRefresh}
          type="button"
        >
          목록 새로고침
        </button>
      }
      description="프로젝트에 등록된 스캔 이력을 한 번에 확인하고, 상태별로 빠르게 이동할 수 있습니다."
      eyebrow="스캔 목록"
      title="프로젝트 스캔 이력"
    >
      <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
        스캔이 진행 중이면 상태 페이지에서 실시간으로 확인하고, 완료된 항목은 결과 확인 화면으로 이동해 확인할 수 있습니다.
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">상태</span>
          <select
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            onChange={(event) => onFilterChange({ ...filters, status: event.target.value as ProjectScanListQuery['status'] })}
            value={filters.status ?? ''}
          >
            <option value="">전체 상태</option>
            {scanStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">방식</span>
          <select
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
            onChange={(event) => onFilterChange({ ...filters, scanMode: event.target.value as ProjectScanListQuery['scanMode'] })}
            value={filters.scanMode ?? ''}
          >
            <option value="">전체 방식</option>
            {scanModes.map((scanMode) => (
              <option key={scanMode} value={scanMode}>
                {scanMode}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          스캔 목록을 불러오는 중입니다...
        </div>
      ) : errorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : scans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          조건에 맞는 스캔 이력이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => (
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={scan.scanId}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ScanStatusBadge status={scan.status} />
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {getScanModeLabel(scan.scanMode)}
                    </span>
                    <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">
                      스캔 #{scan.scanId}
                    </span>
                  </div>
                  <dl className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">요청 시각</dt>
                      <dd className="mt-1 font-semibold text-slate-900">{formatCompactDateTime(scan.requestedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">완료 시각</dt>
                      <dd className="mt-1 font-semibold text-slate-900">{formatCompactDateTime(scan.completedAt)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
                    state={{ projectId }}
                    to={ROUTES.scanDetail.replace(':scanId', String(scan.scanId))}
                  >
                    진행 상태 보기
                  </Link>
                  <Link
                    className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    state={{ projectId }}
                    to={ROUTES.resultDetail.replace(':scanId', String(scan.scanId))}
                  >
                    결과 화면 보기
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

export default ProjectScanList;
