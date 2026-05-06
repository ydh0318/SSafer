export type ScanRequestSource = 'CLI';

export type ScanMode = 'UPLOAD' | 'CLI' | 'AGENT';

export type ScanStatus =
  | 'REQUESTED'
  | 'QUEUED'
  | 'RUNNING'
  | 'RAW_UPLOADED'
  | 'DONE'
  | 'FAILED'
  | 'CANCELED';

export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'ERROR';

export type AgentTaskStatus = 'PENDING' | 'SENT' | 'ACKED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELED';

export type AgentTaskType = string;

export interface CreateScanRequestPayload {
  projectName: string;
  source?: ScanRequestSource;
  scanName?: string;
  targetPath?: string;
  includeLogs?: boolean;
}

export interface CreateScanResponseData {
  scanId: number;
  projectId: number;
  status: ScanStatus;
  rawResultPath: string;
  rawUploadUrl: string;
}

export interface RawScanUploadReportData {
  scanId: number;
  status: ScanStatus;
  resultCount: number | null;
}

export interface ProjectScanListItemData {
  scanId: number;
  status: ScanStatus;
  scanMode: ScanMode;
  requestedAt: string;
  completedAt: string | null;
}

export interface ProjectScanListResponseData {
  items: ProjectScanListItemData[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ProjectScanListQuery {
  page?: number;
  size?: number;
  status?: ScanStatus | '';
  scanMode?: ScanMode | '';
}

export interface ScanProgressStatusData {
  scanId: number;
  status: ScanStatus;
  progressStep: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type FindingResolutionStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED';

export type FindingSourceType = 'TRIVY' | 'CUSTOM_RULE' | 'AI';

export interface ScanBasicData {
  scanId: number;
  projectId: number;
  scanMode: ScanMode;
  status: ScanStatus;
  progressStep: string | null;
  failureReason: string | null;
  rawResultPath: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastUpdatedAt: string | null;
}

export interface ScanSummaryData {
  scanId: number;
  projectId: number;
  totalFindings: number;
  nodeCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  categoryCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  resolutionCounts: Partial<Record<FindingResolutionStatus, number>>;
}

export interface ScanFindingListItemData {
  findingId: number;
  scanId: number;
  scanNodeId: number | null;
  sourceType: FindingSourceType;
  severity: FindingSeverity;
  category: string;
  title: string;
  filePath: string | null;
  lineNumber: number | null;
  resourceName: string | null;
  ruleCode: string;
  resolutionStatus: FindingResolutionStatus;
  createdAt: string;
}

export interface ScanFindingListResponseData {
  items: ScanFindingListItemData[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ScanFindingListQuery {
  severity?: FindingSeverity;
  category?: string;
  resolutionStatus?: FindingResolutionStatus;
  sourceType?: FindingSourceType;
  scanNodeId?: number;
  page?: number;
  size?: number;
}

export interface ScanFindingDetailData {
  findingId: number;
  scanId: number;
  scanNodeId: number | null;
  sourceType: FindingSourceType;
  fingerprint: string | null;
  severity: FindingSeverity;
  category: string;
  title: string;
  description: string | null;
  filePath: string | null;
  lineNumber: number | null;
  resourceName: string | null;
  ruleCode: string;
  attackScenario: string | null;
  remediationGuide: string | null;
  rawSnippetJson: string | null;
  resolutionStatus: FindingResolutionStatus;
  patchApprovedByUserId: number | null;
  patchApprovedAt: string | null;
  patchResultMessage: string | null;
  backupFileName: string | null;
  backupFilePath: string | null;
  backupMetadataJson: string | null;
  patchedAt: string | null;
  createdAt: string;
}

export interface HistoryScanSummaryData {
  totalScanCount: number;
  totalFindingCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
}

export interface HistoryScanListItemData {
  scanId: number;
  projectId: number;
  status: ScanStatus;
  scanMode: ScanMode;
  totalFindingCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  requestedAt: string;
  completedAt: string | null;
}

export interface HistoryScanListResponseData {
  summary: HistoryScanSummaryData;
  items: HistoryScanListItemData[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface HistoryScanListQuery {
  page?: number;
  size?: number;
  projectId?: number;
  status?: ScanStatus;
  scanMode?: ScanMode;
}

export interface AgentStatusResponseData {
  agentId: number;
  status: AgentStatus;
  connectedAt: string | null;
  lastSeenAt: string | null;
  currentTaskType: AgentTaskType | null;
}

export interface PendingAgentTaskPayload {
  [key: string]: unknown;
}

export interface PendingAgentTaskResponseData {
  taskId: number;
  taskType: AgentTaskType;
  taskStatus: AgentTaskStatus;
  projectId: number | null;
  scanId: number | null;
  findingId: number | null;
  payload: PendingAgentTaskPayload | null;
  queuedAt: string;
}
