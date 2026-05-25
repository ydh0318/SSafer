import { publicApiClient } from '../../../api/client';
import { createApiError } from '../../../api/error';
import type { ApiSuccessResponse } from '../../../types/api';
import type { GuestEnterData, GuestEnterRequest } from '../../../types/auth';
import { getGuestDeviceId } from '../../../utils/deviceId';

export async function enterGuestMode() {
  try {
    const payload: GuestEnterRequest = {
      deviceId: getGuestDeviceId(),
    };

    const response = await publicApiClient.post<ApiSuccessResponse<GuestEnterData>>(
      '/guests/enter',
      payload,
    );

    return response.data.data;
  } catch (error) {
    throw createApiError(error, '게스트 모드로 진입하지 못했습니다.');
  }
}
