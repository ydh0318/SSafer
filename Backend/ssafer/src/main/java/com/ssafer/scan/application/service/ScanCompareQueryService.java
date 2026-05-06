package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanCompareResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.repository.ScanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScanCompareQueryService {

  private final ScanRepository scanRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional(readOnly = true)
  public ScanCompareResponse compare(Long baseScanId, Long targetScanId) {
    if (baseScanId == null || targetScanId == null || baseScanId.equals(targetScanId)) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan baseScan = scanRepository.findById(baseScanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    Scan targetScan = scanRepository.findById(targetScanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    // 결과 비교는 같은 프로젝트 안의 두 스캔만 허용한다.
    if (!baseScan.getProjectId().equals(targetScan.getProjectId())) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    // 같은 프로젝트의 스캔이므로 한 번의 프로젝트 권한 검증으로 비교 가능 여부를 확인한다.
    projectAuthorizationService.loadAuthorizedProjectOrThrow(baseScan.getProjectId(), actor);

    return new ScanCompareResponse(
        baseScan.getId(),
        targetScan.getId(),
        baseScan.getProjectId(),
        baseScan.getStatus(),
        targetScan.getStatus()
    );
  }
}
