import { getApiErrorMessage } from '../../../api/error';
import { apiClient } from '../../../api/client';
import type { ApiSuccessResponse } from '../../../types/api';
import type {
  CreateProjectFormValues,
  CreateProjectRequest,
  CreateProjectResponseData,
  ProjectDetailResponseData,
  ProjectListQuery,
  ProjectListResponseData,
  UpdateProjectRequest,
  UpdateProjectResponseData,
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
    const response = await apiClient.post<ApiSuccessResponse<CreateProjectResponseData>>(
      '/projects',
      payload,
    );
    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, '프로젝트를 생성하지 못했습니다.'));
  }
}

export async function getProjects(query: ProjectListQuery = {}) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<ProjectListResponseData>>('/projects', {
      params: {
        page: query.page ?? 0,
        size: query.size ?? 20,
      },
    });

    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, '프로젝트 목록을 불러오지 못했습니다.'));
  }
}

export async function getProjectDetail(projectId: string) {
  try {
    const response = await apiClient.get<ApiSuccessResponse<ProjectDetailResponseData>>(
      `/projects/${projectId}`,
    );
    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, '프로젝트 상세 정보를 불러오지 못했습니다.'));
  }
}

export async function updateProject(projectId: string, payload: UpdateProjectRequest) {
  try {
    const response = await apiClient.patch<ApiSuccessResponse<UpdateProjectResponseData>>(
      `/projects/${projectId}`,
      payload,
    );
    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, '프로젝트를 수정하지 못했습니다.'));
  }
}

export async function deleteProject(projectId: string) {
  try {
    await apiClient.delete<ApiSuccessResponse<null>>(`/projects/${projectId}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, '프로젝트를 삭제하지 못했습니다.'));
  }
}
