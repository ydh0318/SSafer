package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanBasicResponse;
import com.ssafer.scan.api.mapper.ScanBasicResponseMapper;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.repository.ScanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScanBasicQueryService {

  private final ScanRepository scanRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional(readOnly = true)
  public ScanBasicResponse getScanBasic(Long scanId) {
    // 현재 요청 주체를 먼저 확보해 프로젝트 접근 권한을 판단한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan scan = scanRepository.findById(scanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    // 단건 조회 경로를 쓰더라도 실제 접근 범위는 scan.projectId 기준으로 제한한다.
    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);
    return ScanBasicResponseMapper.toResponse(scan);
  }
}
