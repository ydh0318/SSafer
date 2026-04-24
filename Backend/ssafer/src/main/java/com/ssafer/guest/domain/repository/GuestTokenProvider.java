package com.ssafer.guest.domain.repository;

import com.ssafer.guest.application.service.GuestEnterResult;

public interface GuestTokenProvider {

  GuestEnterResult issueGuestToken(String deviceId);
}
