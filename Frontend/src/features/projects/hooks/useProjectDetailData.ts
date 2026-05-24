import { useEffect, useState } from 'react';

import type { ProjectDetailResponseData } from '../../../types/project';
import { getProjectDetail } from '../api/projects';

function useProjectDetailData(projectId: string) {
  const [projectDetail, setProjectDetail] = useState<ProjectDetailResponseData | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let isMounted = true;

    const loadProject = async () => {
      setIsProjectLoading(true);
      setProjectError(null);

      try {
        const data = await getProjectDetail(projectId);

        if (isMounted) {
          setProjectDetail(data);
        }
      } catch (error) {
        if (isMounted) {
          setProjectDetail(null);
          setProjectError(error instanceof Error ? error.message : 'Failed to load project details.');
        }
      } finally {
        if (isMounted) {
          setIsProjectLoading(false);
        }
      }
    };

    void loadProject();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  return {
    isProjectLoading,
    projectDetail,
    projectError,
  };
}

export default useProjectDetailData;
