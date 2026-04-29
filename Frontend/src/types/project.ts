import type { RiskLevel, WorkStatus } from '../mocks/ssaferMockData';

export type ScanMode = 'UPLOAD' | 'AGENT';

export interface CreateProjectRequest {
  name: string;
  description?: string | null;
  defaultScanMode?: ScanMode;
  monitorEnabled?: boolean;
}

export interface CreateProjectResponseData {
  projectId: number;
}

export interface CreateProjectFormValues {
  name: string;
  description: string;
  defaultScanMode: ScanMode;
  monitorEnabled: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
  owner: string;
  scans: number;
  lastStatus: WorkStatus;
  risk: RiskLevel;
  description: string;
  defaultScanMode: ScanMode;
  monitorEnabled: boolean;
}
