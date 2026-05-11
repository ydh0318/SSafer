package com.ssafer.scan.application.service;

import com.ssafer.global.security.AuthenticatedActor;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class ScanStatusSseEmitterRegistry {

  private final Map<String, Map<String, SseEmitter>> emittersByActorKey = new ConcurrentHashMap<>();

  public SseEmitter register(AuthenticatedActor actor, SseEmitter emitter) {
    // 같은 회원/게스트 주체가 여러 화면에서 동시에 구독할 수 있으므로 actorKey 아래 emitter를 여러 개 보관한다.
    String actorKey = toActorKey(actor);
    String emitterId = UUID.randomUUID().toString();

    emittersByActorKey
        .computeIfAbsent(actorKey, ignored -> new ConcurrentHashMap<>())
        .put(emitterId, emitter);

    emitter.onCompletion(() -> remove(actorKey, emitterId));
    emitter.onTimeout(() -> remove(actorKey, emitterId));
    emitter.onError(ignored -> remove(actorKey, emitterId));

    return emitter;
  }

  public Collection<SseEmitter> getEmitters(AuthenticatedActor actor) {
    Map<String, SseEmitter> emitters = emittersByActorKey.get(toActorKey(actor));
    if (emitters == null || emitters.isEmpty()) {
      return List.of();
    }
    return List.copyOf(emitters.values());
  }

  int countEmitters(AuthenticatedActor actor) {
    return getEmitters(actor).size();
  }

  private void remove(String actorKey, String emitterId) {
    Map<String, SseEmitter> emitters = emittersByActorKey.get(actorKey);
    if (emitters == null) {
      return;
    }
    emitters.remove(emitterId);
    if (emitters.isEmpty()) {
      emittersByActorKey.remove(actorKey, emitters);
    }
  }

  private String toActorKey(AuthenticatedActor actor) {
    if (actor.isMember()) {
      return "MEMBER:" + actor.userId();
    }
    return "GUEST:" + actor.guestOwnerKeyHash();
  }
}
