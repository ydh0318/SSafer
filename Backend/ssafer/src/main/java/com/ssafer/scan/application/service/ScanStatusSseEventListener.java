package com.ssafer.scan.application.service;

import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@Slf4j
@RequiredArgsConstructor
// SSE는 프론트가 즉시 후속 조회를 하기 때문에, 상태 변경 커밋 이후에만 실제 이벤트를 발행한다.
public class ScanStatusSseEventListener {

  private final ScanRepository scanRepository;
  private final ScanStatusSseEventPublisher scanStatusSseEventPublisher;

  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void onRequested(ScanStatusSsePublishRequestedEvent event) {
    Scan scan = scanRepository.findByIdAndDeletedAtIsNull(event.scanId()).orElse(null);
    if (scan == null) {
      log.warn("스캔 상태 SSE 발행을 건너뜁니다. scan을 찾을 수 없습니다. scanId={}", event.scanId());
      return;
    }

    if (scan.getStatus() != event.expectedStatus()) {
      log.info(
          "스캔 상태 SSE 발행을 건너뜁니다. 기대 상태와 현재 상태가 다릅니다. scanId={}, expectedStatus={}, actualStatus={}",
          event.scanId(),
          event.expectedStatus(),
          scan.getStatus()
      );
      return;
    }

    if (scan.getStatus() == ScanStatus.DONE) {
      scanStatusSseEventPublisher.publishCompleted(scan);
      return;
    }

    if (scan.getStatus() == ScanStatus.FAILED) {
      scanStatusSseEventPublisher.publishFailed(scan);
      return;
    }

    log.info("스캔 상태 SSE 발행을 건너뜁니다. 지원하지 않는 상태입니다. scanId={}, status={}", event.scanId(), scan.getStatus());
  }
}
