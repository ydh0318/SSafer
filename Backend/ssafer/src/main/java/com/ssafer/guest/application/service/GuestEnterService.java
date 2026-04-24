package com.ssafer.guest.application.service;

import com.ssafer.guest.domain.repository.GuestTokenProvider;
import org.springframework.stereotype.Service;

@Service
public class GuestEnterService implements GuestEnterUseCase {

  private final GuestTokenProvider guestTokenProvider;

  public GuestEnterService(GuestTokenProvider guestTokenProvider) {
    this.guestTokenProvider = guestTokenProvider;
  }

  @Override
  public GuestEnterResult enter(GuestEnterCommand command) {
    return guestTokenProvider.issueGuestToken(command.deviceId());
  }
}
