import type { FindingSeverity, ScanFindingDetailData } from '../../../types/scan';

export const findingSeverityMeta: Record<FindingSeverity, { bg: string; fg: string; soft: string }> = {
  CRITICAL: { bg: '#E63946', fg: '#FFFFFF', soft: '#FFE5E5' },
  HIGH: { bg: '#FF8A33', fg: '#FFFFFF', soft: '#FFF1E5' },
  MEDIUM: { bg: '#FFB627', fg: '#111111', soft: '#FFF9DB' },
  LOW: { bg: '#3D5AFE', fg: '#FFFFFF', soft: '#E5EBFF' },
  INFO: { bg: '#9CA3AF', fg: '#FFFFFF', soft: '#F3F4F6' },
};

export const findingSeverityOrder: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export const findingResolutionValues = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED'] as const;

export const findingResolutionMeta: Record<string, { label: string; cls: string; dot: string }> = {
  OPEN: { label: '미해결', cls: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-400' },
  IN_PROGRESS: {
    label: '진행 중',
    cls: 'border border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-400',
  },
  RESOLVED: { label: '조치 완료', cls: 'bg-[#EDFFC0] text-[#4A7A00]', dot: 'bg-[#9FCC2E]' },
  IGNORED: { label: '무시', cls: 'bg-neutral-100 text-neutral-400', dot: 'bg-neutral-300' },
};

export function prettyJsonText(value: string | null) {
  if (!value) {
    return '구조화된 데이터가 없습니다.';
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function getPracticeSnippet(finding: ScanFindingDetailData | null) {
  if (!finding) {
    return '';
  }

  const preferred = [finding.remediationGuide, finding.patchResultMessage, finding.title].find((value) =>
    Boolean(value && value.trim()),
  );

  return preferred ?? '';
}
