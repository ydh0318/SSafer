import { useEffect, useMemo, useRef, useState } from 'react';

import type { ProjectSummary } from '../../../types/project';

const SELECTED_PROJECT_STORAGE_KEY = 'ssafer:selected-project-id';

type UseProjectSelectionOptions = {
  projects: ProjectSummary[];
  focusProjectId?: string;
};

function getStoredProjectId() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
}

function useProjectSelection({ projects, focusProjectId }: UseProjectSelectionOptions) {
  const [preferredProjectId, setPreferredProjectId] = useState<string | null>(() => getStoredProjectId());
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const projectSelectRef = useRef<HTMLDivElement | null>(null);

  const selectedProjectId = useMemo(() => {
    if (projects.length === 0) {
      return null;
    }

    if (focusProjectId && projects.some((project) => project.id === focusProjectId)) {
      return focusProjectId;
    }

    if (preferredProjectId && projects.some((project) => project.id === preferredProjectId)) {
      return preferredProjectId;
    }

    return projects[0].id;
  }, [focusProjectId, preferredProjectId, projects]);

  const filteredProjects = useMemo(() => {
    const keyword = projectSearchTerm.trim().toLowerCase();

    if (!keyword) {
      return projects;
    }

    return projects.filter((project) => {
      const name = project.name.toLowerCase();
      const id = project.id.toLowerCase();
      return name.includes(keyword) || id.includes(keyword);
    });
  }, [projectSearchTerm, projects]);

  useEffect(() => {
    if (!isProjectDropdownOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!projectSelectRef.current?.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isProjectDropdownOpen]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    window.sessionStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, selectedProjectId);
  }, [selectedProjectId]);

  const selectProjectById = (projectId: string) => {
    setPreferredProjectId(projectId);
  };

  return {
    filteredProjects,
    isProjectDropdownOpen,
    projectSearchTerm,
    projectSelectRef,
    selectProjectById,
    selectedProjectId,
    setIsProjectDropdownOpen,
    setProjectSearchTerm,
  };
}

export default useProjectSelection;
