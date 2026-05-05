package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.CliRawResultUploadReportRequest;
import com.ssafer.scan.api.dto.CliRawResultUploadReportResponseData;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
@Slf4j
@RequiredArgsConstructor
// 공개 CLI 완료 알림 API의 검증과 상태 전환을 담당한다.
public class CliRawResultUploadReportService {

  private static final Pattern PAYLOAD_HASH_PATTERN = Pattern.compile("^sha256:[a-fA-F0-9]{64}$");

  private final ScanRepository scanRepository;
  private final ProjectAuthorizationService projectAuthorizationService;
  private final RawResultObjectVerifier rawResultObjectVerifier;
  private final ObjectMapper objectMapper;

  @Transactional
  public CliRawResultUploadReportResponseData report(
      Long scanId,
      AuthenticatedActor actor,
      CliRawResultUploadReportRequest request
  ) {
    // 동시 요청 충돌 방지를 위해 scan row를 write lock으로 조회한다.
    Scan scan = scanRepository.findByIdForUpdate(scanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    // 권한, 입력값, 상태, S3 객체 존재 여부를 순서대로 검증한다.
    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);
    validatePayloadHash(request.payloadHash());
    validateScanStatus(scan.getStatus());
    validateRawObjectExists(scan.getRawResultPath());

    // 최초 완료 알림만 RAW_UPLOADED로 전환하고 메타데이터를 raw_result_json에 남긴다.
    LocalDateTime now = LocalDateTime.now();
    scan.updateRawResult(
        ScanStatus.RAW_UPLOADED,
        scan.getProgressStep(),
        scan.getFailureReason(),
        buildRawResultMetadataJson(request),
        scan.getRawResultPath(),
        scan.getStartedAt() != null ? scan.getStartedAt() : now,
        scan.getCompletedAt(),
        now
    );

    log.info(
        "CLI analysis completion accepted: scanId={}, actorType={}, actorUserId={}, status={}",
        scan.getId(),
        actor.actorType(),
        actor.userId(),
        scan.getStatus()
    );

    return new CliRawResultUploadReportResponseData(scan.getId(), scan.getStatus(), request.resultCount());
  }

  private void validatePayloadHash(String payloadHash) {
    if (!hasText(payloadHash)) {
      return;
    }
    if (!PAYLOAD_HASH_PATTERN.matcher(payloadHash).matches()) {
      log.warn("Invalid payloadHash format on CLI analysis completion: payloadHash={}", payloadHash);
      throw new BusinessException(ErrorCode.INVALID_PAYLOAD_HASH);
    }
  }

  private void validateScanStatus(ScanStatus status) {
    switch (status) {
      case REQUESTED:
        return;
      // 이미 완료 알림을 받았거나 이후 단계로 진행된 상태다.
      case RAW_UPLOADED:
      case QUEUED:
      case RUNNING:
      case DONE:
        log.warn("Duplicate CLI analysis completion blocked: scanStatus={}", status);
        throw new BusinessException(ErrorCode.DUPLICATE_RAW_RESULT_UPLOAD);
      // 아직 결과를 받지 않았더라도 현재 정책상 완료 알림을 받을 수 없는 상태다.
      case FAILED:
      case CANCELED:
      default:
        log.warn("CLI analysis completion rejected by scan status policy: scanStatus={}", status);
        throw new BusinessException(ErrorCode.SCAN_STATUS_CONFLICT);
    }
  }

  private void validateRawObjectExists(String rawResultPath) {
    if (!hasText(rawResultPath) || !rawResultObjectVerifier.exists(rawResultPath)) {
      log.warn("CLI analysis completion rejected because raw object was not found: rawResultPath={}", rawResultPath);
      throw new BusinessException(ErrorCode.RAW_RESULT_NOT_FOUND);
    }
  }

  private String buildRawResultMetadataJson(CliRawResultUploadReportRequest request) {
    Map<String, Object> metadata = new LinkedHashMap<>();
    metadata.put("tool", normalizeBlank(request.tool()));
    metadata.put("toolVersion", normalizeBlank(request.toolVersion()));
    metadata.put("resultCount", request.resultCount());
    metadata.put("payloadHash", normalizePayloadHash(request.payloadHash()));
    try {
      return objectMapper.writeValueAsString(metadata);
    } catch (Exception ex) {
      log.error("Failed to serialize raw_result_json metadata", ex);
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }

  private String normalizePayloadHash(String payloadHash) {
    if (!hasText(payloadHash)) {
      return null;
    }
    return payloadHash.toLowerCase(Locale.ROOT);
  }

  private String normalizeBlank(String value) {
    return hasText(value) ? value : null;
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
