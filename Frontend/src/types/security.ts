export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type WorkStatus = 'DONE' | 'ANALYZING' | 'FAILED' | 'OPEN' | 'APPROVED' | 'NEW' | 'READ' | 'ONLINE' | 'OFFLINE';

export type ProjectSummary = {
  id: string;
  name: string;
  owner: string;
  scans: number;
  lastStatus: WorkStatus;
  risk: RiskLevel;
  description: string;
};

export type ScanSummaryItem = {
  id: string;
  project: string;
  source: 'UPLOAD' | 'AGENT';
  status: WorkStatus;
  scannedAt: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type FindingListItem = {
  id: string;
  nodeId: string;
  category: string;
  ruleId: string;
  severity: RiskLevel;
  status: WorkStatus;
  file: string;
  line: number | null;
  title: string;
  evidence: string;
  plain: string;
  whyRisky: string;
  impact: string;
  fix: string;
  before: string;
  after: string;
};

export function formatFindingLocation(finding: FindingListItem) {
  return `${finding.file}${finding.line ? `:${finding.line}` : ''}`;
}

export function countFindingSeverity(items: FindingListItem[]) {
  return items.reduce(
    (acc, finding) => {
      const key = finding.severity.toLowerCase() as keyof typeof acc;
      acc[key] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );
}
