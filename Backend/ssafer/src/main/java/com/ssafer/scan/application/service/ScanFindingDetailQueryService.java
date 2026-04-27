package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanFindingDetailResponse;
import com.ssafer.scan.api.mapper.ScanFindingDetailResponseMapper;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScanFindingDetailQueryService {

  private final ScanRepository scanRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional(readOnly = true)
  public ScanFindingDetailResponse getScanFindingDetail(Long scanId, Long findingId) {
    // 현재 요청 주체를 먼저 확인하고, 스캔이 속한 프로젝트 접근 권한을 검증한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan scan = scanRepository.findById(scanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);

    // findingId만 신뢰하지 않고 scanId까지 함께 확인해 다른 스캔 결과를 섞어 읽지 않게 한다.
    ScanFinding finding = scanFindingRepository.findByIdAndScanId(findingId, scanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    return ScanFindingDetailResponseMapper.toResponse(finding);
  }
}
