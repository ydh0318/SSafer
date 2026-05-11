package com.ssafer.scan.api.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.application.service.ScanStatusSseSubscriptionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@ExtendWith(MockitoExtension.class)
class ScanStatusSseControllerTest {

  @Mock
  private CurrentActorProvider currentActorProvider;
  @Mock
  private ScanStatusSseSubscriptionService scanStatusSseSubscriptionService;

  @InjectMocks
  private ScanStatusSseController scanStatusSseController;

  @Test
  void subscribeReturnsEmitterForCurrentActor() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    SseEmitter emitter = new SseEmitter();
    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanStatusSseSubscriptionService.subscribe(actor)).thenReturn(emitter);

    SseEmitter response = scanStatusSseController.subscribe();

    assertThat(response).isSameAs(emitter);
    verify(scanStatusSseSubscriptionService).subscribe(actor);
  }
}
