package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.AnalysisResultDownloadUrlResponseData;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
// 완료된 scan의 analysis_result.json을 CLI가 내려받을 수 있도록 Presigned URL 발급을 조율한다.
public class AnalysisResultDownloadUrlService {

  private final ScanRepository scanRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;
  private final AnalysisResultDownloadUrlIssuer analysisResultDownloadUrlIssuer;

  @Transactional(readOnly = true)
  public AnalysisResultDownloadUrlResponseData issueDownloadUrl(Long scanId) {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan scan = scanRepository.findById(scanId)
        .filter(found -> !found.isDeleted())
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    // 다운로드 URL 발급 전에도 기존 scan 조회와 동일하게 프로젝트 소유 권한을 검증한다.
    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);
    validateDownloadable(scan);

    // DB에 저장된 S3 URI를 기준으로 짧은 만료 시간의 다운로드 URL만 외부에 노출한다.
    String analysisResultPath = scan.getAnalysisResultPath().trim();
    AnalysisResultDownloadUrl issuedUrl = analysisResultDownloadUrlIssuer.issueGetUrl(analysisResultPath);
    return new AnalysisResultDownloadUrlResponseData(
        analysisResultPath,
        issuedUrl.downloadUrl(),
        issuedUrl.expiresInSeconds()
    );
  }

  private void validateDownloadable(Scan scan) {
    // 워커 분석과 DB 적재가 끝난 DONE 상태에서만 analysis_result.json 다운로드를 허용한다.
    if (scan.getStatus() != ScanStatus.DONE) {
      throw new BusinessException(ErrorCode.SCAN_STATUS_CONFLICT);
    }
    if (scan.getAnalysisResultPath() == null || scan.getAnalysisResultPath().isBlank()) {
      throw new BusinessException(ErrorCode.ANALYSIS_RESULT_NOT_FOUND);
    }
  }
}
