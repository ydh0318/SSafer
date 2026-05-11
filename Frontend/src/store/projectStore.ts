import { create } from 'zustand';

import type { ProjectDetailResponseData, ProjectListItemData, ProjectSummary } from '../types/project';

function mapProjectListItem(item: ProjectListItemData): ProjectSummary {
  return {
    id: String(item.projectId),
    name: item.name,
    owner: 'MY WORKSPACE',
    scans: 0,
    lastStatus: 'NEW',
    risk: 'LOW',
    description: '프로젝트 설명이 아직 없습니다.',
    defaultScanMode: item.defaultScanMode,
    monitorEnabled: item.monitorEnabled,
    createdAt: item.createdAt,
  };
}

function mergeProjectDetail(baseProject: ProjectSummary | undefined, detail: ProjectDetailResponseData): ProjectSummary {
  return {
    id: String(detail.projectId),
    name: detail.name,
    owner: baseProject?.owner ?? 'MY WORKSPACE',
    scans: baseProject?.scans ?? 0,
    lastStatus: baseProject?.lastStatus ?? 'NEW',
    risk: baseProject?.risk ?? 'LOW',
    description: detail.description?.trim() || '프로젝트 설명이 아직 없습니다.',
    defaultScanMode: detail.defaultScanMode,
    monitorEnabled: detail.monitorEnabled,
    createdAt: baseProject?.createdAt,
  };
}

type ProjectState = {
  projects: ProjectSummary[];
  totalElements: number;
  totalPages: number;
  setProjectsFromList: (items: ProjectListItemData[], totalElements: number, totalPages: number) => void;
  upsertProjectDetail: (detail: ProjectDetailResponseData) => void;
  addProject: (project: ProjectSummary) => void;
  removeProject: (projectId: string) => void;
  reset: () => void;
};

const initialProjectState = {
  projects: [] as ProjectSummary[],
  totalElements: 0,
  totalPages: 0,
};

export const useProjectStore = create<ProjectState>((set) => ({
  ...initialProjectState,
  setProjectsFromList: (items, totalElements, totalPages) =>
    set(() => ({
      projects: items.map(mapProjectListItem),
      totalElements,
      totalPages,
    })),
  upsertProjectDetail: (detail) =>
    set((state) => {
      const nextProject = mergeProjectDetail(
        state.projects.find((project) => project.id === String(detail.projectId)),
        detail,
      );

      const hasExisting = state.projects.some((project) => project.id === nextProject.id);

      return {
        projects: hasExisting
          ? state.projects.map((project) => (project.id === nextProject.id ? nextProject : project))
          : [...state.projects, nextProject],
      };
    }),
  addProject: (project) =>
    set((state) => ({
      projects: [project, ...state.projects],
      totalElements: state.totalElements + 1,
    })),
  removeProject: (projectId) =>
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== projectId),
      totalElements: Math.max(0, state.totalElements - 1),
    })),
  reset: () => set(() => ({ ...initialProjectState })),
}));
