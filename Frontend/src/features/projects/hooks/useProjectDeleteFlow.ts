import { useState } from 'react';

import { useProjectStore } from '../../../store/projectStore';
import { deleteProject } from '../api/projects';

type ProjectDeleteTarget = {
  id: string;
  name: string;
};

type UseProjectDeleteFlowOptions = {
  onDeleted?: (project: ProjectDeleteTarget) => void;
};

function useProjectDeleteFlow({ onDeleted }: UseProjectDeleteFlowOptions = {}) {
  const removeProject = useProjectStore((state) => state.removeProject);
  const [targetProject, setTargetProject] = useState<ProjectDeleteTarget | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openDeleteModal = (project: ProjectDeleteTarget) => {
    setTargetProject(project);
    setErrorMessage(null);
  };

  const closeDeleteModal = () => {
    if (isDeleting) {
      return;
    }

    setTargetProject(null);
    setErrorMessage(null);
  };

  const confirmDelete = async () => {
    if (!targetProject) {
      return false;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteProject(targetProject.id);
      removeProject(targetProject.id);
      onDeleted?.(targetProject);
      setTargetProject(null);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '프로젝트 삭제 중 오류가 발생했습니다.');
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    closeDeleteModal,
    confirmDelete,
    errorMessage,
    isDeleteModalOpen: Boolean(targetProject),
    isDeleting,
    openDeleteModal,
    targetProject,
  };
}

export default useProjectDeleteFlow;
