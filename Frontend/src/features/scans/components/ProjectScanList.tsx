import { Filter, RefreshCw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import SectionPanel from '../../../components/common/SectionPanel';
import { ROUTES } from '../../../constants/routes';
import type { ProjectScanListItemData, ProjectScanListQuery, ScanMode, ScanStatus } from '../../../types/scan';
import { canDeleteScanHistory, formatCompactDateTime, getDeleteBlockedReason, getScanModeLabel, getScanStatusLabel } from '../utils/scanPresentation';
import ScanStatusBadge from './ScanStatusBadge';
import ScanTypeBadge from './ScanTypeBadge';

const scanStatuses: Array<ScanStatus> = ['REQUESTED', 'QUEUED', 'RUNNING', 'RAW_UPLOADED', 'DONE', 'FAILED', 'CANCELED'];
const scanModes: Array<{ value: ScanMode; label: string }> = [
  { value: 'AGENT', label: 'Agent / CLI 스캔' },
  { value: 'UPLOAD', label: '파일 업로드 스캔' },
];

type ProjectScanListProps = {
  projectId: string;
  scans: ProjectScanListItemData[];
  filters: ProjectScanListQuery;
  isLoading: boolean;
  errorMessage: string | null;
  deletingScanIds: number[];
  onFilterChange: (nextValue: ProjectScanListQuery) => void;
  onDeleteScan: (scanId: number) => void;
  onRefresh: () => void;
};

function ProjectScanList({
  projectId,
  scans,
  filters,
  isLoading,
  errorMessage,
  deletingScanIds,
  onFilterChange,
  onDeleteScan,
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
          새로고침
        </button>
      }
      description="프로젝트의 스캔 이력을 확인하고, 완료된 결과로 이동하거나 삭제 가능한 스캔을 정리할 수 있습니다."
      eyebrow="SCAN HISTORY"
      title="프로젝트 스캔"
    >
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block space-y-2">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.24em] text-neutral-500">
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
                {getScanStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.24em] text-neutral-500">
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
            {scanModes.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
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
        <div className="theme-dark-soft-card border border-dashed border-neutral-300 bg-[#fafafa] px-4 py-6 text-sm text-neutral-600">
          현재 조건에 맞는 스캔이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => {
            const isDeleting = deletingScanIds.includes(scan.scanId);
            const isDeleteAllowed = canDeleteScanHistory(scan.status);
            const deleteBlockedReason = getDeleteBlockedReason(scan.status);

            return (
              <article className="border border-neutral-200 bg-white p-4 shadow-sm" key={scan.scanId}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ScanStatusBadge status={scan.status} />
                      <ScanTypeBadge scanType={scan.scanType} />
                      <span className="inline-flex rounded-full border border-neutral-200 bg-[#f5f5f5] px-2.5 py-1 text-xs font-bold text-neutral-700">
                        {getScanModeLabel(scan.scanMode, scan.source)}
                      </span>
                      <span className="inline-flex rounded-full bg-black px-2.5 py-1 text-xs font-bold text-white">
                        스캔 #{scan.scanId}
                      </span>
                    </div>

                    <dl className="grid gap-3 text-sm text-neutral-600 md:grid-cols-2">
                      <div>
                        <dt className="text-[11px] font-bold tracking-[0.24em] text-neutral-400">요청 시각</dt>
                        <dd className="mt-1 font-semibold text-black">{formatCompactDateTime(scan.requestedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold tracking-[0.24em] text-neutral-400">완료 시각</dt>
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
                      진행 상태 보기
                    </Link>
                    {scan.status === 'DONE' ? (
                      <>
                        <Link
                          className="bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                          state={{ projectId }}
                          to={ROUTES.resultDetail.replace(':scanId', String(scan.scanId))}
                        >
                          결과 보기
                        </Link>
                        <button
                          aria-disabled="true"
                          className="border border-dashed border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-400"
                          title="결과 삭제 기능은 아직 연결된 작업 흐름이 없습니다."
                          type="button"
                        >
                          결과 삭제 준비 중
                        </button>
                      </>
                    ) : (
                      <span
                        className="inline-flex cursor-not-allowed items-center bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-500"
                        title="스캔이 완료되어야 결과를 확인할 수 있습니다."
                      >
                        결과 없음
                      </span>
                    )}
                    <button
                      className={
                        isDeleteAllowed && !isDeleting
                          ? 'inline-flex items-center gap-2 border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-50'
                          : 'inline-flex cursor-not-allowed items-center gap-2 border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-400'
                      }
                      disabled={!isDeleteAllowed || isDeleting}
                      onClick={() => onDeleteScan(scan.scanId)}
                      title={isDeleteAllowed ? undefined : deleteBlockedReason ?? undefined}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeleting ? '삭제 중...' : '이력 삭제'}
                    </button>
                  </div>
                </div>
                {scan.status !== 'DONE' ? (
                  <p className="mt-3 text-xs text-neutral-500">스캔이 완료되면 결과 화면으로 바로 이동할 수 있습니다.</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </SectionPanel>
  );
}

export default ProjectScanList;
