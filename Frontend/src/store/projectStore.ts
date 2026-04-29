import { create } from 'zustand';

import { projects as mockProjects } from '../mocks/ssaferMockData';
import type { ProjectSummary } from '../types/project';

type ProjectStoreState = {
  projects: ProjectSummary[];
  addProject: (project: ProjectSummary) => void;
  findProjectById: (projectId: string) => ProjectSummary | undefined;
};

const initialProjects: ProjectSummary[] = mockProjects.map((project) => ({
  ...project,
  defaultScanMode: 'AGENT',
  monitorEnabled: false,
}));

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: initialProjects,
  addProject: (project) => {
    set((state) => ({
      projects: [project, ...state.projects.filter((item) => item.id !== project.id)],
    }));
  },
  findProjectById: (projectId) => get().projects.find((project) => project.id === projectId),
}));
