package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.ssafer.global.security.AuthenticatedActor;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class ScanStatusSseEmitterRegistryTest {

  private final ScanStatusSseEmitterRegistry registry = new ScanStatusSseEmitterRegistry();

  @Test
  void registerStoresEmitterByMemberActor() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);

    registry.register(actor, new SseEmitter());

    assertThat(registry.getEmitters(actor)).hasSize(1);
  }

  @Test
  void registerStoresEmitterByGuestActor() {
    AuthenticatedActor actor = AuthenticatedActor.guest("guest-owner-key");

    registry.register(actor, new SseEmitter());

    assertThat(registry.getEmitters(actor)).hasSize(1);
  }
}
