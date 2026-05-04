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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
// 공개 CLI 완료 보고 API의 핵심 검증/상태 전환 로직.
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
    // 1) scan 존재 확인
    Scan scan = scanRepository.findById(scanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    // 2) 권한/입력/상태/S3 객체 존재 순서로 검증
    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);
    validatePayloadHash(request.payloadHash());
    validateScanStatus(scan.getStatus());
    validateRawObjectExists(scan.getRawResultPath());

    // 3) 최초 성공 보고 시점에만 RAW_UPLOADED로 전환하고 raw_result_json에 메타데이터를 저장
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

    return new CliRawResultUploadReportResponseData(scan.getId(), scan.getStatus(), request.resultCount());
  }

  private void validatePayloadHash(String payloadHash) {
    if (!hasText(payloadHash)) {
      return;
    }
    if (!PAYLOAD_HASH_PATTERN.matcher(payloadHash).matches()) {
      throw new BusinessException(ErrorCode.INVALID_PAYLOAD_HASH);
    }
  }

  private void validateScanStatus(ScanStatus status) {
    // 이미 raw 결과가 접수된 상태는 duplicate로 우선 반환한다.
    if (status == ScanStatus.RAW_UPLOADED
        || status == ScanStatus.QUEUED
        || status == ScanStatus.RUNNING
        || status == ScanStatus.DONE) {
      throw new BusinessException(ErrorCode.DUPLICATE_RAW_RESULT_UPLOAD);
    }
    if (status == ScanStatus.FAILED || status == ScanStatus.CANCELED) {
      throw new BusinessException(ErrorCode.SCAN_STATUS_CONFLICT);
    }
    if (status != ScanStatus.REQUESTED) {
      throw new BusinessException(ErrorCode.SCAN_STATUS_CONFLICT);
    }
  }

  private void validateRawObjectExists(String rawResultPath) {
    if (!hasText(rawResultPath) || !rawResultObjectVerifier.exists(rawResultPath)) {
      throw new BusinessException(ErrorCode.RAW_RESULT_NOT_FOUND);
    }
  }

  private String buildRawResultMetadataJson(CliRawResultUploadReportRequest request) {
    // 별도 컬럼 대신 raw_result_json에 CLI 보고 메타데이터를 저장한다.
    Map<String, Object> metadata = new LinkedHashMap<>();
    metadata.put("tool", normalizeBlank(request.tool()));
    metadata.put("toolVersion", normalizeBlank(request.toolVersion()));
    metadata.put("resultCount", request.resultCount());
    metadata.put("payloadHash", normalizePayloadHash(request.payloadHash()));
    try {
      return objectMapper.writeValueAsString(metadata);
    } catch (Exception ex) {
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
