package com.ssafer.scan.application.service;

import com.ssafer.global.security.AuthenticatedActor;
import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
@Slf4j
@RequiredArgsConstructor
public class ScanStatusSseSubscriptionService {

  private static final long SSE_TIMEOUT_MILLIS = 30L * 60L * 1000L;

  private final ScanStatusSseEmitterRegistry emitterRegistry;

  public SseEmitter subscribe(AuthenticatedActor actor) {
    // SSE 연결이 실제로 열렸는지 프론트가 바로 알 수 있도록 connected 이벤트를 먼저 한 번 보낸다.
    SseEmitter emitter = emitterRegistry.register(actor, new SseEmitter(SSE_TIMEOUT_MILLIS));
    sendConnectedEvent(actor, emitter);
    return emitter;
  }

  private void sendConnectedEvent(AuthenticatedActor actor, SseEmitter emitter) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("actorType", actor.actorType().name());
    payload.put("userId", actor.userId());
    payload.put("guestOwnerKeyHash", actor.guestOwnerKeyHash());
    payload.put("subscribedAt", Instant.now().toString());

    try {
      emitter.send(SseEmitter.event()
          .name("connected")
          .data(payload));
    } catch (IOException ex) {
      log.warn("Failed to send initial SSE connected event", ex);
      emitter.completeWithError(ex);
    }
  }
}
