import type {
  FindingResolutionStatus,
  FindingSeverity,
  ScanFindingDetailData,
  ScanFindingListItemData,
  ScanSummaryData,
} from '../../../types/scan';

export const severityMeta: Record<FindingSeverity, { bg: string; fg: string; soft: string; label: string }> = {
  CRITICAL: { bg: '#E63946', fg: '#FFFFFF', soft: '#FFE5E5', label: 'CRITICAL' },
  HIGH: { bg: '#FF8A33', fg: '#FFFFFF', soft: '#FFF1E5', label: 'HIGH' },
  MEDIUM: { bg: '#FFB627', fg: '#111111', soft: '#FFF9DB', label: 'MEDIUM' },
  LOW: { bg: '#3D5AFE', fg: '#FFFFFF', soft: '#E5EBFF', label: 'LOW' },
  INFO: { bg: '#9CA3AF', fg: '#FFFFFF', soft: '#F3F4F6', label: 'INFO' },
};

export const severityOrder: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
export const resolutionValues = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED'] as const;

export const resolutionMeta: Record<typeof resolutionValues[number], { label: string; cls: string; dot: string }> = {
  OPEN: { label: '미조치', cls: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-400' },
  IN_PROGRESS: {
    label: '진행 중',
    cls: 'border border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-400',
  },
  RESOLVED: { label: '조치 완료', cls: 'bg-[#EDFFC0] text-[#4A7A00]', dot: 'bg-[#9FCC2E]' },
  IGNORED: { label: '무시', cls: 'bg-neutral-100 text-neutral-400', dot: 'bg-neutral-300' },
};

export function getResolutionCount(summary: ScanSummaryData | null, status: FindingResolutionStatus) {
  return summary?.resolutionCounts?.[status] ?? 0;
}

export function getSourceCount(summary: ScanSummaryData | null, sourceType: string) {
  return summary?.sourceCounts?.[sourceType] ?? 0;
}

export function formatFindingLocation(finding: ScanFindingListItemData) {
  const target = finding.filePath || finding.resourceName || '알 수 없는 대상';

  if (finding.lineNumber && finding.lineNumber > 0) {
    return `${target}:${finding.lineNumber}`;
  }

  return target;
}

function getFindingTitleGroupKey(title: string) {
  return (title.trim() || '제목 없는 취약점')
    .replace(/라인\(\d+\)/g, '라인(*)')
    .replace(/line\(\d+\)/gi, 'line(*)')
    .replace(/\(\d+\)/g, '(*)')
    .replace(/\b\d{2,5}\b/g, '*');
}

export function groupFindingsByTitle(findings: ScanFindingListItemData[]) {
  const groups = new Map<string, { title: string; items: ScanFindingListItemData[] }>();

  findings.forEach((finding) => {
    const key = getFindingTitleGroupKey(finding.title);
    const group = groups.get(key) ?? { title: key, items: [] };
    group.items.push(finding);
    groups.set(key, group);
  });

  return Array.from(groups.values());
}

export function hasApplicablePatchPayload(finding: ScanFindingDetailData | undefined) {
  if (!finding?.patchPayloadJson) {
    return false;
  }

  return Boolean(
    finding.fix?.patches?.some((patch) => {
      return Boolean(patch.filePath && patch.operation);
    }),
  );
}
