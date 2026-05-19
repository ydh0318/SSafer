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
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FindingResolutionStatusUpdateService {

  private final ScanRepository scanRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional
  public FindingResolutionStatusUpdateResponseData updateStatus(
      Long findingId,
      ResolutionStatus status
  ) {
    if (status == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    ScanFinding finding = scanFindingRepository.findByIdForUpdate(findingId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    Scan scan = scanRepository.findByIdAndDeletedAtIsNull(finding.getScanId())
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);

    ResolutionStatus previousStatus = finding.getResolutionStatus();
    finding.changeResolutionStatusManually(status, actor, LocalDateTime.now());

    return new FindingResolutionStatusUpdateResponseData(
        finding.getId(),
        finding.getScanId(),
        previousStatus,
        finding.getResolutionStatus(),
        finding.getResolutionStatusSource(),
        finding.getResolutionStatusChangedActorType(),
        finding.getResolutionStatusChangedByUserId(),
        finding.getResolutionStatusChangedAt()
    );
  }
}
