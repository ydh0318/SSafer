package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.DeleteScanResponseData;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.util.EnumSet;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScanDeletionService {

  private static final EnumSet<ScanStatus> DELETABLE_STATUSES = EnumSet.of(
      ScanStatus.REQUESTED,
      ScanStatus.DONE,
      ScanStatus.FAILED,
      ScanStatus.CANCELED
  );

  private final ScanRepository scanRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional
  public DeleteScanResponseData deleteScan(Long scanId) {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan scan = scanRepository.findByIdForUpdate(scanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (scan.isDeleted()) {
      throw new BusinessException(ErrorCode.NOT_FOUND);
    }

    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);
    validateDeletableStatus(scan.getStatus());
    scan.softDelete();

    return new DeleteScanResponseData(scan.getId(), scan.getDeletedAt());
  }

  private void validateDeletableStatus(ScanStatus status) {
    if (!DELETABLE_STATUSES.contains(status)) {
      throw new BusinessException(ErrorCode.SCAN_STATUS_CONFLICT);
    }
  }
}
