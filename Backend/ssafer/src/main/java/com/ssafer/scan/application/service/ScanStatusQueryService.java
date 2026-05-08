package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanStatusResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.repository.ScanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScanStatusQueryService {

  private final ScanRepository scanRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional(readOnly = true)
  public ScanStatusResponse getScanStatus(Long scanId) {
    // 현재 요청 주체(회원/게스트)를 기준으로 스캔 접근 가능 여부를 함께 검증한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan scan = scanRepository.findById(scanId)
        .filter(found -> !found.isDeleted())
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    // scanId 자체로 조회하더라도, 실제 반환 전에는 프로젝트 소유/권한 검증을 강제한다.
    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);

    // API 명세의 errorMessage는 DB의 failureReason 값을 그대로 매핑한다.
    return new ScanStatusResponse(
        scan.getId(),
        scan.getStatus(),
        scan.getProgressStep(),
        scan.getRequestedAt(),
        scan.getStartedAt(),
        scan.getCompletedAt(),
        scan.getFailureReason()
    );
  }
}
