import { getApiErrorMessage } from '../../../api/error';
import { apiClient } from '../../../api/client';
import type { ApiSuccessResponse } from '../../../types/api';
import type {
  CreateProjectFormValues,
  CreateProjectRequest,
  CreateProjectResponseData,
} from '../../../types/project';

function normalizeProjectRequest(values: CreateProjectFormValues): CreateProjectRequest {
  const name = values.name.trim();
  const description = values.description.trim();

  return {
    name,
    description: description ? description : null,
    defaultScanMode: values.defaultScanMode,
    monitorEnabled: values.monitorEnabled,
  };
}

export async function createProject(values: CreateProjectFormValues) {
  try {
    const payload = normalizeProjectRequest(values);
    const response = await apiClient.post<ApiSuccessResponse<CreateProjectResponseData>>('/projects', payload);
    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, '프로젝트 생성에 실패했습니다.'));
  }
}
