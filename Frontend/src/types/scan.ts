export type ScanRequestSource = 'CLI';

export type ScanMode = 'UPLOAD' | 'AGENT';

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
