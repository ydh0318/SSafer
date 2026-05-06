import { Filter, RefreshCw } from 'lucide-react';
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
          className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-black hover:text-black"
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw className="h-4 w-4" />
          목록 새로고침
        </button>
      }
      description="프로젝트의 실제 스캔 목록을 확인하고, 완료된 스캔만 결과 페이지로 이동할 수 있습니다."
      eyebrow="SCAN HISTORY"
      title="프로젝트 스캔 목록"
    >
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block space-y-2">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">
            <Filter className="h-3.5 w-3.5" />
            상태
          </span>
          <select
            className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black"
            onChange={(event) =>
              onFilterChange({
                ...filters,
                status: event.target.value as ProjectScanListQuery['status'],
              })
            }
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
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">
            <Filter className="h-3.5 w-3.5" />
            스캔 방식
          </span>
          <select
            className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black"
            onChange={(event) =>
              onFilterChange({
                ...filters,
                scanMode: event.target.value as ProjectScanListQuery['scanMode'],
              })
            }
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
        <div className="border border-neutral-200 bg-[#fafafa] px-4 py-5 text-sm text-neutral-600">
          스캔 목록을 불러오는 중입니다...
        </div>
      ) : errorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">{errorMessage}</div>
      ) : scans.length === 0 ? (
        <div className="border border-dashed border-neutral-300 bg-[#fafafa] px-4 py-6 text-sm text-neutral-600">
          조건에 맞는 스캔이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => (
            <article className="border border-neutral-200 bg-white p-4 shadow-sm" key={scan.scanId}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ScanStatusBadge status={scan.status} />
                    <span className="inline-flex rounded-full border border-neutral-200 bg-[#f5f5f5] px-2.5 py-1 text-xs font-bold text-neutral-700">
                      {getScanModeLabel(scan.scanMode)}
                    </span>
                    <span className="inline-flex rounded-full bg-black px-2.5 py-1 text-xs font-bold text-white">
                      Scan #{scan.scanId}
                    </span>
                  </div>

                  <dl className="grid gap-3 text-sm text-neutral-600 md:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">요청 시각</dt>
                      <dd className="mt-1 font-semibold text-black">{formatCompactDateTime(scan.requestedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">완료 시각</dt>
                      <dd className="mt-1 font-semibold text-black">{formatCompactDateTime(scan.completedAt)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    className="border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-black hover:text-black"
                    state={{ projectId }}
                    to={ROUTES.scanDetail.replace(':scanId', String(scan.scanId))}
                  >
                    진행 현황
                  </Link>
                  {scan.status === 'DONE' ? (
                    <Link
                      className="bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                      state={{ projectId }}
                      to={ROUTES.resultDetail.replace(':scanId', String(scan.scanId))}
                    >
                      결과 보기
                    </Link>
                  ) : (
                    <span
                      className="inline-flex cursor-not-allowed items-center bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-500"
                      title="스캔이 완료된 뒤 결과 페이지를 열 수 있습니다."
                    >
                      결과 대기 중
                    </span>
                  )}
                </div>
              </div>
              {scan.status !== 'DONE' ? (
                <p className="mt-3 text-xs text-neutral-500">스캔이 완료되면 결과 보기 버튼이 활성화됩니다.</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

export default ProjectScanList;
