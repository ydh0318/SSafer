package com.ssafer.scan.application.service;

import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.api.mapper.ScanRequestSourceResolver;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Collection;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
@Slf4j
@RequiredArgsConstructor
// scan 최종 상태가 확정되면 현재 scan 요청 주체에게 SSE 이벤트를 전파한다.
public class ScanStatusSseEventPublisher {

  private final ProjectRepository projectRepository;
  private final ScanStatusSseEmitterRegistry emitterRegistry;

  public void publishCompleted(Scan scan) {
    publish(scan, "scan.completed");
  }

  public void publishFailed(Scan scan) {
    publish(scan, "scan.failed");
  }

  private void publish(Scan scan, String eventName) {
    // 회원은 요청 사용자 ID로, 게스트는 프로젝트 owner key hash로 구독 대상을 찾는다.
    AuthenticatedActor actor = resolveActor(scan);
    if (actor == null) {
      return;
    }

    Collection<SseEmitter> emitters = emitterRegistry.getEmitters(actor);
    if (emitters.isEmpty()) {
      log.info(
          "스캔 상태 SSE 이벤트를 건너뜁니다. 구독자가 없습니다. scanId={}, event={}, actorType={}, userId={}, guestOwnerKeyHash={}",
          scan.getId(),
          eventName,
          actor.actorType(),
          actor.userId(),
          actor.guestOwnerKeyHash()
      );
      return;
    }

    ScanStatusSseEvent payload = new ScanStatusSseEvent(
        scan.getId(),
        scan.getProjectId(),
        scan.getStatus(),
        scan.getScanMode(),
        scan.getScanType(),
        ScanRequestSourceResolver.resolve(scan),
        scan.getProgressStep(),
        scan.getFailureReason(),
        scan.getRequestedAt(),
        scan.getStartedAt(),
        scan.getCompletedAt(),
        scan.getLastUpdatedAt()
    );

    log.info(
        "스캔 상태 SSE 이벤트를 발행합니다. scanId={}, event={}, emitterCount={}, status={}, scanMode={}, scanType={}, source={}",
        scan.getId(),
        eventName,
        emitters.size(),
        scan.getStatus(),
        scan.getScanMode(),
        scan.getScanType(),
        payload.source()
    );

    for (SseEmitter emitter : emitters) {
      try {
        emitter.send(SseEmitter.event()
            .name(eventName)
            .data(payload));
      } catch (IOException ex) {
        log.warn("스캔 상태 SSE 이벤트 전송에 실패했습니다. scanId={}, event={}", scan.getId(), eventName, ex);
        emitter.completeWithError(ex);
      }
    }
  }

  private AuthenticatedActor resolveActor(Scan scan) {
    if (scan.getRequestActorType() == RequestActorType.USER && scan.getRequestedByUserId() != null) {
      return AuthenticatedActor.member(scan.getRequestedByUserId());
    }

    if (scan.getRequestActorType() != RequestActorType.GUEST) {
      return null;
    }

    // 게스트 scan은 project에 저장된 guest owner key hash를 기준으로 같은 브라우저 세션을 찾는다.
    Project project = projectRepository.findById(scan.getProjectId()).orElse(null);
    if (project == null || project.getGuestOwnerKeyHash() == null || project.getGuestOwnerKeyHash().isBlank()) {
      return null;
    }
    return AuthenticatedActor.guest(project.getGuestOwnerKeyHash());
  }

  public record ScanStatusSseEvent(
      Long scanId,
      Long projectId,
      com.ssafer.scan.domain.enums.ScanStatus status,
      com.ssafer.scan.domain.enums.ScanMode scanMode,
      com.ssafer.scan.domain.enums.ScanType scanType,
      com.ssafer.scan.domain.enums.ScanRequestSource source,
      String progressStep,
      String failureReason,
      LocalDateTime requestedAt,
      LocalDateTime startedAt,
      LocalDateTime completedAt,
      LocalDateTime lastUpdatedAt
  ) {
  }
}
