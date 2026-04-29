import { getApiErrorMessage } from '../../../api/error';
import { apiClient } from '../../../api/client';
import { getGuestDeviceId } from '../../../utils/deviceId';
import type { GuestEnterData, GuestEnterRequest } from '../../../types/auth';
import type { ApiSuccessResponse } from '../../../types/api';

export async function enterGuestMode() {
  try {
    const payload: GuestEnterRequest = {
      deviceId: getGuestDeviceId(),
    };

    const response = await apiClient.post<ApiSuccessResponse<GuestEnterData>>('/guests/enter', payload);
    return response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, '게스트 세션 발급에 실패했습니다.'));
  }
}
