package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.ssafer.global.security.AuthenticatedActor;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class ScanStatusSseSubscriptionServiceTest {

  private final ScanStatusSseEmitterRegistry emitterRegistry = new ScanStatusSseEmitterRegistry();
  private final ScanStatusSseSubscriptionService subscriptionService =
      new ScanStatusSseSubscriptionService(emitterRegistry);

  @Test
  void subscribeRegistersEmitterForActor() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);

    SseEmitter emitter = subscriptionService.subscribe(actor);

    assertThat(emitter).isNotNull();
    assertThat(emitterRegistry.getEmitters(actor)).contains(emitter);
  }
}
