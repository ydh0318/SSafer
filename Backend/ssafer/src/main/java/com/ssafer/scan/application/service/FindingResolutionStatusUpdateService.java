package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.FindingResolutionStatusUpdateResponseData;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FindingResolutionStatusUpdateService {

  private static final int MAX_REASON_LENGTH = 1000;

  private final ScanRepository scanRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional
  public FindingResolutionStatusUpdateResponseData updateStatus(
      Long findingId,
      ResolutionStatus status,
      String reason
  ) {
    if (status == null || normalizedReason(reason).length() > MAX_REASON_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    ScanFinding finding = scanFindingRepository.findByIdForUpdate(findingId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    Scan scan = scanRepository.findByIdAndDeletedAtIsNull(finding.getScanId())
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);

    ResolutionStatus previousStatus = finding.getResolutionStatus();
    finding.changeResolutionStatus(status);

    return new FindingResolutionStatusUpdateResponseData(
        finding.getId(),
        finding.getScanId(),
        previousStatus,
        finding.getResolutionStatus()
    );
  }

  private String normalizedReason(String reason) {
    return reason == null ? "" : reason.trim();
  }
}
