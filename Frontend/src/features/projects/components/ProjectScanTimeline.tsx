import { Filter, RefreshCw } from 'lucide-react';

import type { ProjectScanListItemData, ProjectScanListQuery, ScanMode, ScanStatus } from '../../../types/scan';
import ScanTimeline, { type ScanTimelineItem } from '../../scans/components/ScanTimeline';
import { getScanStatusLabel } from '../../scans/utils/scanPresentation';

const scanStatuses: Array<ScanStatus> = ['REQUESTED', 'QUEUED', 'RUNNING', 'RAW_UPLOADED', 'DONE', 'FAILED', 'CANCELED'];
const scanModes: Array<{ value: ScanMode; label: string }> = [
  { value: 'AGENT', label: '에이전트 / CLI 스캔' },
  { value: 'UPLOAD', label: '파일 업로드 스캔' },
];

type ProjectScanTimelineProps = {
  projectId: string;
  scans: ProjectScanListItemData[];
  filters: ProjectScanListQuery;
  isLoading: boolean;
  errorMessage: string | null;
  deletingScanIds: number[];
  onFilterChange: (next: ProjectScanListQuery) => void;
  onDeleteScan: (scanId: number) => void;
  onRefresh: () => void;
};

function ProjectScanTimeline({
  projectId,
  scans,
  filters,
  isLoading,
  errorMessage,
  deletingScanIds,
  onFilterChange,
  onDeleteScan,
  onRefresh,
}: ProjectScanTimelineProps) {
  const items: ScanTimelineItem[] = scans.map((scan) => ({
    scanId: scan.scanId,
    status: scan.status,
    scanMode: scan.scanMode,
    scanType: scan.scanType,
    source: scan.source,
    requestedAt: scan.requestedAt,
    completedAt: scan.completedAt,
  }));

  return (
    <section className="space-y-5 landing-anim">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-[#0F0F0F] md:text-2xl">스캔 이력</h2>
          <p className="mt-1 text-xs text-neutral-500">최신순으로 정렬됩니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            ariaLabel="상태 필터"
            onChange={(value) => onFilterChange({ ...filters, status: value as ProjectScanListQuery['status'] })}
            options={[{ value: '', label: '전체 상태' }, ...scanStatuses.map((status) => ({ value: status, label: getScanStatusLabel(status) }))]}
            value={filters.status ?? ''}
          />
          <FilterSelect
            ariaLabel="스캔 방식 필터"
            onChange={(value) => onFilterChange({ ...filters, scanMode: value as ProjectScanListQuery['scanMode'] })}
            options={[{ value: '', label: '전체 방식' }, ...scanModes.map((mode) => ({ value: mode.value, label: mode.label }))]}
            value={filters.scanMode ?? ''}
          />
          <button
            className="inline-flex items-center gap-1.5 border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 transition landing-inner-radius hover:border-black hover:text-black"
            onClick={onRefresh}
            type="button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            새로고침
          </button>
        </div>
      </div>

      <ScanTimeline
        deletingScanIds={deletingScanIds}
        errorMessage={errorMessage}
        isLoading={isLoading}
        items={items}
        onDeleteScan={onDeleteScan}
        routeProjectId={projectId}
      />
    </section>
  );
}

type FilterSelectProps = {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
};

function FilterSelect({ options, value, onChange, ariaLabel }: FilterSelectProps) {
  return (
    <label className="inline-flex items-center gap-1.5 border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 transition landing-inner-radius hover:border-black">
      <Filter className="h-3.5 w-3.5 text-neutral-400" />
      <select
        aria-label={ariaLabel}
        className="bg-transparent text-xs font-bold text-neutral-700 outline-none"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default ProjectScanTimeline;
