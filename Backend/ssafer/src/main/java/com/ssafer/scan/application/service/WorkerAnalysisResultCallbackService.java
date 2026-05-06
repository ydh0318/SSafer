package com.ssafer.scan.application.service;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

import com.ssafer.scan.api.dto.WorkerAnalysisResultCallbackRequest;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
// 워커 분석 완료 콜백을 받아 scan 상태와 결과 경로를 갱신한다.
public class WorkerAnalysisResultCallbackService {

  private final ScanRepository scanRepository;

  @Transactional
  public Scan report(Long scanId, WorkerAnalysisResultCallbackRequest request) {
    Scan scan = scanRepository.findById(scanId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Scan not found: " + scanId));

    validateReportable(scan);

    ScanStatus status = resolveStatus(request);
    validateRequestedStatus(status, request);

    LocalDateTime now = LocalDateTime.now();
    LocalDateTime lastUpdatedAt = resolveLastUpdatedAt(request, now);
    LocalDateTime completedAt = resolveCompletedAt(scan, request, status, lastUpdatedAt);
    LocalDateTime startedAt = resolveStartedAt(scan, request, status, lastUpdatedAt, completedAt);

    validateResolvedTimeRange(startedAt, completedAt);

    // 현재 단계에서는 결과 파일 자체는 S3에 두고, 콜백은 상태와 경로만 반영한다.
    scan.updateRawResult(
        status,
        request.progressStep(),
        normalizeBlank(request.failureReason()),
        scan.getRawResultJson(),
        normalizeBlank(request.rawResultPath()),
        startedAt,
        completedAt,
        lastUpdatedAt
    );

    return scan;
  }

  private void validateReportable(Scan scan) {
    if (scan.getStatus().isTerminal() || scan.getStatus() == ScanStatus.RAW_UPLOADED) {
      throw new ResponseStatusException(
          CONFLICT,
          "Analysis result callback is not allowed for current scan status: " + scan.getStatus());
    }
  }

  private ScanStatus resolveStatus(WorkerAnalysisResultCallbackRequest request) {
    return request.status() != null ? request.status() : ScanStatus.RAW_UPLOADED;
  }

  private void validateRequestedStatus(ScanStatus status, WorkerAnalysisResultCallbackRequest request) {
    if (status != ScanStatus.RAW_UPLOADED && status != ScanStatus.FAILED) {
      throw new ResponseStatusException(
          BAD_REQUEST,
          "Analysis result callback only supports RAW_UPLOADED or FAILED status");
    }

    if (status == ScanStatus.RAW_UPLOADED && !hasText(request.rawResultPath())) {
      throw new ResponseStatusException(BAD_REQUEST, "RAW_UPLOADED status requires rawResultPath");
    }

    if (status == ScanStatus.RAW_UPLOADED && request.completedAt() != null) {
      throw new ResponseStatusException(
          BAD_REQUEST,
          "RAW_UPLOADED status cannot include completedAt");
    }

    if (status == ScanStatus.FAILED && !hasText(request.failureReason())) {
      throw new ResponseStatusException(BAD_REQUEST, "FAILED status requires failureReason");
    }
  }

  private LocalDateTime resolveLastUpdatedAt(WorkerAnalysisResultCallbackRequest request, LocalDateTime now) {
    return request.lastUpdatedAt() != null
        ? request.lastUpdatedAt()
        : request.completedAt() != null ? request.completedAt() : now;
  }

  private LocalDateTime resolveStartedAt(
      Scan scan,
      WorkerAnalysisResultCallbackRequest request,
      ScanStatus status,
      LocalDateTime lastUpdatedAt,
      LocalDateTime completedAt
  ) {
    if (request.startedAt() != null) {
      return request.startedAt();
    }
    if (scan.getStartedAt() != null) {
      return scan.getStartedAt();
    }
    if (status == ScanStatus.FAILED && completedAt != null) {
      return completedAt;
    }
    return status == ScanStatus.RAW_UPLOADED ? lastUpdatedAt : null;
  }

  private LocalDateTime resolveCompletedAt(
      Scan scan,
      WorkerAnalysisResultCallbackRequest request,
      ScanStatus status,
      LocalDateTime lastUpdatedAt
  ) {
    if (request.completedAt() != null) {
      return request.completedAt();
    }
    if (scan.getCompletedAt() != null) {
      return scan.getCompletedAt();
    }
    return status == ScanStatus.FAILED ? lastUpdatedAt : null;
  }

  private void validateResolvedTimeRange(LocalDateTime startedAt, LocalDateTime completedAt) {
    if (startedAt != null && completedAt != null && startedAt.isAfter(completedAt)) {
      throw new ResponseStatusException(
          BAD_REQUEST,
          "startedAt must be before or equal to completedAt");
    }
  }

  private String normalizeBlank(String value) {
    return hasText(value) ? value : null;
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
