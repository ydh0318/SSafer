import type { RiskLevel, WorkStatus } from './security';
import type { ScanMode } from './scan';

export type { ScanMode } from './scan';

export interface CreateProjectRequest {
  name: string;
  description?: string | null;
  defaultScanMode?: ScanMode;
  monitorEnabled?: boolean;
}

export interface CreateProjectResponseData {
  projectId: number;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
  defaultScanMode?: ScanMode;
  monitorEnabled?: boolean;
}

export interface UpdateProjectResponseData {
  projectId: number;
}

export interface CreateProjectFormValues {
  name: string;
  description: string;
  defaultScanMode: ScanMode;
  monitorEnabled: boolean;
}

export interface ProjectListItemData {
  projectId: number;
  name: string;
  defaultScanMode: ScanMode;
  monitorEnabled: boolean;
  createdAt: string;
}

export interface ProjectListResponseData {
  items: ProjectListItemData[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ProjectDetailResponseData {
  projectId: number;
  name: string;
  description: string | null;
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
  createdAt?: string;
}

export interface ProjectListQuery {
  page?: number;
  size?: number;
}
