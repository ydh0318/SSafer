import { Filter, RefreshCw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import SectionPanel from '../../../components/common/SectionPanel';
import { ROUTES } from '../../../constants/routes';
import type { ProjectScanListItemData, ProjectScanListQuery, ScanMode, ScanStatus } from '../../../types/scan';
import { canDeleteScanHistory, formatCompactDateTime, getScanModeLabel } from '../utils/scanPresentation';
import ScanStatusBadge from './ScanStatusBadge';

const scanStatuses: Array<ScanStatus> = ['REQUESTED', 'QUEUED', 'RUNNING', 'RAW_UPLOADED', 'DONE', 'FAILED', 'CANCELED'];
const scanModes: Array<ScanMode> = ['AGENT', 'UPLOAD'];

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
          ?덈줈怨좎묠
        </button>
      }
      description="?꾨줈?앺듃蹂??ㅼ틪 吏꾪뻾 ?곹솴怨??꾨즺??寃곌낵 ?먮쫫?????붾㈃?먯꽌 ?뺤씤?????덉뒿?덈떎."
      eyebrow="SCAN HISTORY"
      title="?꾨줈?앺듃 ?ㅼ틪 紐⑸줉"
    >
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block space-y-2">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">
            <Filter className="h-3.5 w-3.5" />
            Status
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
            <option value="">?꾩껜 ?곹깭</option>
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
            Scan Mode
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
            <option value="">?꾩껜 諛⑹떇</option>
            {scanModes.map((scanMode) => (
              <option key={scanMode} value={scanMode}>
                {scanMode}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="border border-neutral-200 bg-[#fafafa] px-4 py-5 text-sm text-neutral-600">?ㅼ틪 紐⑸줉??遺덈윭?ㅻ뒗 以묒엯?덈떎...</div>
      ) : errorMessage ? (
        <div className="border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">{errorMessage}</div>
      ) : scans.length === 0 ? (
        <div className="theme-dark-soft-card border border-dashed border-neutral-300 bg-[#fafafa] px-4 py-6 text-sm text-neutral-600">
          議곌굔??留욌뒗 ?ㅼ틪???꾩쭅 ?놁뒿?덈떎.
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => {
            const isDeleting = deletingScanIds.includes(scan.scanId);
            const isDeleteAllowed = canDeleteScanHistory(scan.status);

            return (
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
                        <dt className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Requested</dt>
                        <dd className="mt-1 font-semibold text-black">{formatCompactDateTime(scan.requestedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Completed</dt>
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
                      吏꾪뻾 ?꾪솴
                    </Link>
                    {scan.status === 'DONE' ? (
                      <>
                        <Link
                          className="bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                          state={{ projectId }}
                          to={ROUTES.resultDetail.replace(':scanId', String(scan.scanId))}
                        >
                          寃곌낵 蹂닿린
                        </Link>
                        <button
                          aria-disabled="true"
                          className="border border-dashed border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-400"
                          title="寃곌낵 ??젣 API ?곌껐 ??諛붾줈 ?쒖꽦?뷀븷 踰꾪듉?낅땲??"
                          type="button"
                        >
                          寃곌낵 ??젣 ?덉젙
                        </button>
                      </>
                    ) : (
                      <span
                        className="inline-flex cursor-not-allowed items-center bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-500"
                        title="?ㅼ틪???꾨즺?섎㈃ 寃곌낵 蹂닿린 踰꾪듉???쒖꽦?붾맗?덈떎."
                      >
                        寃곌낵 ?湲?以?
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
                      title={isDeleteAllowed ? undefined : 'Only REQUESTED, DONE, FAILED, and CANCELED scans can be deleted.'}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
                {scan.status !== 'DONE' ? (
                  <p className="mt-3 text-xs text-neutral-500">?ㅼ틪???앸굹硫?寃곌낵 ?붾㈃?쇰줈 諛붾줈 ?댁뼱???뺤씤?????덉뒿?덈떎.</p>
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
