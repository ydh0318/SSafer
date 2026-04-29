import { create } from 'zustand';

import type {
  ProjectDetailResponseData,
  ProjectListItemData,
  ProjectSummary,
} from '../types/project';

const DEFAULT_PROJECT_OWNER = 'Accessible Project';

function mapProjectListItem(item: ProjectListItemData): ProjectSummary {
  return {
    id: String(item.projectId),
    name: item.name,
    owner: DEFAULT_PROJECT_OWNER,
    scans: 0,
    lastStatus: 'NEW',
    risk: 'LOW',
    description: '프로젝트 상세 설명은 상세 조회 시 불러옵니다.',
    defaultScanMode: item.defaultScanMode,
    monitorEnabled: item.monitorEnabled,
    createdAt: item.createdAt,
  };
}

function mergeProjectDetail(
  baseProject: ProjectSummary | undefined,
  detail: ProjectDetailResponseData,
): ProjectSummary {
  return {
    id: String(detail.projectId),
    name: detail.name,
    owner: baseProject?.owner ?? DEFAULT_PROJECT_OWNER,
    scans: baseProject?.scans ?? 0,
    lastStatus: baseProject?.lastStatus ?? 'NEW',
    risk: baseProject?.risk ?? 'LOW',
    description: detail.description?.trim() || '프로젝트 설명이 없습니다.',
    defaultScanMode: detail.defaultScanMode,
    monitorEnabled: detail.monitorEnabled,
    createdAt: baseProject?.createdAt,
  };
}

type ProjectStoreState = {
  projects: ProjectSummary[];
  totalElements: number;
  totalPages: number;
  setProjectsFromList: (items: ProjectListItemData[], totalElements: number, totalPages: number) => void;
  addProject: (project: ProjectSummary) => void;
  upsertProjectDetail: (detail: ProjectDetailResponseData) => void;
  updateProjectLocally: (projectId: string, updater: (project: ProjectSummary) => ProjectSummary) => void;
  removeProject: (projectId: string) => void;
  findProjectById: (projectId: string) => ProjectSummary | undefined;
};

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: [],
  totalElements: 0,
  totalPages: 0,
  setProjectsFromList: (items, totalElements, totalPages) => {
    set((state) => {
      const existingById = new Map(state.projects.map((project) => [project.id, project]));
      const nextProjects = items.map((item) => {
        const mapped = mapProjectListItem(item);
        const existing = existingById.get(mapped.id);
        return existing ? { ...existing, ...mapped, description: existing.description } : mapped;
      });

      return {
        projects: nextProjects,
        totalElements,
        totalPages,
      };
    });
  },
  addProject: (project) => {
    set((state) => ({
      projects: [project, ...state.projects.filter((item) => item.id !== project.id)],
      totalElements: state.totalElements + (state.projects.some((item) => item.id === project.id) ? 0 : 1),
    }));
  },
  upsertProjectDetail: (detail) => {
    set((state) => {
      const current = state.projects.find((project) => project.id === String(detail.projectId));
      const nextProject = mergeProjectDetail(current, detail);

      return {
        projects: [nextProject, ...state.projects.filter((project) => project.id !== nextProject.id)],
      };
    });
  },
  updateProjectLocally: (projectId, updater) => {
    set((state) => ({
      projects: state.projects.map((project) => (project.id === projectId ? updater(project) : project)),
    }));
  },
  removeProject: (projectId) => {
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== projectId),
      totalElements: Math.max(0, state.totalElements - 1),
    }));
  },
  findProjectById: (projectId) => get().projects.find((project) => project.id === projectId),
}));
