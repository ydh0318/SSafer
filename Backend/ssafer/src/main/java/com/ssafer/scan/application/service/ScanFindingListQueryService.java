package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanFindingListItemResponse;
import com.ssafer.scan.api.mapper.ScanFindingListResponseMapper;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScanFindingListQueryService {

  private final ScanRepository scanRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional(readOnly = true)
  public List<ScanFindingListItemResponse> getScanFindings(Long scanId) {
    // 목록 조회도 먼저 현재 요청 주체를 구한 뒤 스캔이 속한 프로젝트 접근 권한을 검사한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan scan = scanRepository.findById(scanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);

    // 첫 구현 단계에서는 scan 단위 전체 결과를 최신 생성 순으로 내려준다.
    return scanFindingRepository.findByScanIdOrderByCreatedAtDesc(scanId).stream()
        .map(ScanFindingListResponseMapper::toResponse)
        .toList();
  }
}
