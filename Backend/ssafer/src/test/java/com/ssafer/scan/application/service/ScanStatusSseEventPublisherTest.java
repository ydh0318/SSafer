package com.ssafer.scan.application.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@ExtendWith(MockitoExtension.class)
class ScanStatusSseEventPublisherTest {

  @Mock
  private ProjectRepository projectRepository;

  @Mock
  private SseEmitter emitter;

  @Test
  void publishCompletedSendsEventToMemberEmitters() throws Exception {
    ScanStatusSseEmitterRegistry emitterRegistry = new ScanStatusSseEmitterRegistry();
    AuthenticatedActor actor = AuthenticatedActor.member(20L);
    emitterRegistry.register(actor, emitter);
    ScanStatusSseEventPublisher publisher = new ScanStatusSseEventPublisher(projectRepository, emitterRegistry);

    publisher.publishCompleted(memberScan());

    verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
  }

  @Test
  void publishFailedSendsEventToGuestEmitters() throws Exception {
    ScanStatusSseEmitterRegistry emitterRegistry = new ScanStatusSseEmitterRegistry();
    AuthenticatedActor actor = AuthenticatedActor.guest("guest-key");
    emitterRegistry.register(actor, emitter);
    ScanStatusSseEventPublisher publisher = new ScanStatusSseEventPublisher(projectRepository, emitterRegistry);
    when(projectRepository.findById(10L)).thenReturn(Optional.of(new Project(null, "guest-key", "guest-project", null, ScanMode.AGENT, false)));

    publisher.publishFailed(guestScan());

    verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
  }

  @Test
  void publishSkipsWhenNoTargetActorCanBeResolved() throws Exception {
    ScanStatusSseEmitterRegistry emitterRegistry = new ScanStatusSseEmitterRegistry();
    ScanStatusSseEventPublisher publisher = new ScanStatusSseEventPublisher(projectRepository, emitterRegistry);

    publisher.publishFailed(systemScan());

    verify(emitter, never()).send(any(SseEmitter.SseEventBuilder.class));
  }

  private Scan memberScan() {
    return Scan.builder()
        .id(1L)
        .projectId(10L)
        .requestedByUserId(20L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.DONE)
        .progressStep("ANALYSIS_RESULT_SAVED")
        .targetSnapshotJson("{\"source\":\"CLI\"}")
        .requestedAt(LocalDateTime.of(2026, 5, 11, 15, 0))
        .startedAt(LocalDateTime.of(2026, 5, 11, 15, 1))
        .completedAt(LocalDateTime.of(2026, 5, 11, 15, 2))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 11, 15, 2))
        .build();
  }

  private Scan guestScan() {
    return Scan.builder()
        .id(2L)
        .projectId(10L)
        .requestActorType(RequestActorType.GUEST)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.FAILED)
        .progressStep("ANALYSIS_FAILED")
        .failureReason("worker failed")
        .targetSnapshotJson("{\"source\":\"CLI\"}")
        .requestedAt(LocalDateTime.of(2026, 5, 11, 15, 0))
        .startedAt(LocalDateTime.of(2026, 5, 11, 15, 1))
        .completedAt(LocalDateTime.of(2026, 5, 11, 15, 2))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 11, 15, 2))
        .build();
  }

  private Scan systemScan() {
    return Scan.builder()
        .id(3L)
        .projectId(10L)
        .requestActorType(RequestActorType.SYSTEM)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.FAILED)
        .requestedAt(LocalDateTime.of(2026, 5, 11, 15, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 5, 11, 15, 1))
        .build();
  }
}
