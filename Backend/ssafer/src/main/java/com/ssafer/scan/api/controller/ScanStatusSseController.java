package com.ssafer.scan.api.controller;

import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.application.service.ScanStatusSseSubscriptionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Tag(name = "스캔 상태 SSE 구독", description = "스캔 완료/실패 실시간 알림을 구독하는 SSE API")
@RestController
@RequestMapping("/api/v1/scan-events")
@RequiredArgsConstructor
public class ScanStatusSseController {

  private final CurrentActorProvider currentActorProvider;
  private final ScanStatusSseSubscriptionService scanStatusSseSubscriptionService;

  @GetMapping(path = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  @Operation(summary = "스캔 상태 SSE 구독", description = "회원/게스트 주체 기준으로 스캔 상태 실시간 알림을 구독합니다.")
  public SseEmitter subscribe() {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    return scanStatusSseSubscriptionService.subscribe(actor);
  }
}
