package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class UploadScanService {

  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;
  private final UploadScanFileValidator uploadScanFileValidator;
  private final ScanExecutionPermit scanExecutionPermit;
  private final ScanRepository scanRepository;
  private final WebUploadScanProcessor webUploadScanProcessor;
  private final ObjectMapper objectMapper;

  public UploadScanResult requestUploadScan(Long projectId, String scanName, List<MultipartFile> files) {
    // 태스크1/2 기준 진입점: 요청 검증 후 REQUESTED 생성, 실행 처리는 processor로 위임한다.
    // 1) 호출 사용자 식별 및 프로젝트 접근 권한 검증
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    projectAuthorizationService.loadAuthorizedProjectOrThrow(projectId, actor);

    // 2) 업로드 파일 정책 검증(개수/용량/파일명 규칙)
    uploadScanFileValidator.validate(files);

    // 3) 동시 실행 제한 permit 획득 실패 시 즉시 429 처리
    boolean acquired = scanExecutionPermit.tryAcquire();
    if (!acquired) {
      throw new BusinessException(ErrorCode.SCAN_EXECUTION_BUSY);
    }

    try {
      // 4) Scan REQUESTED 생성/저장(짧은 DB 트랜잭션)
      Scan saved = scanRepository.save(buildRequestedScan(actor, projectId, scanName, files));

      // 5) 긴 작업(파일 저장/스캔/결과 생성)은 DB 트랜잭션 바깥에서 처리
      webUploadScanProcessor.process(new UploadScanProcessingCommand(
          saved.getId(),
          projectId,
          scanName,
          List.copyOf(files)
      ));

      return new UploadScanResult(saved.getId(), saved.getStatus());
    } finally {
      // 예외 여부와 관계없이 permit은 반드시 반환
      scanExecutionPermit.release();
    }
  }

  private Scan buildRequestedScan(
      AuthenticatedActor actor,
      Long projectId,
      String scanName,
      List<MultipartFile> files
  ) {
    LocalDateTime now = LocalDateTime.now();
    return Scan.builder()
        .projectId(projectId)
        .requestedByUserId(actor.isMember() ? actor.userId() : null)
        .requestActorType(actor.isMember() ? RequestActorType.USER : RequestActorType.GUEST)
        .scanMode(ScanMode.UPLOAD)
        .status(ScanStatus.REQUESTED)
        .targetSnapshotJson(serializeTargetSnapshot(scanName, files))
        .requestedAt(now)
        .lastUpdatedAt(now)
        .build();
  }

  private String serializeTargetSnapshot(String scanName, List<MultipartFile> files) {
    // 요청 시점의 최소 메타데이터를 snapshot JSON으로 저장한다.
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("scanName", scanName);
    snapshot.put("fileNames", files.stream().map(MultipartFile::getOriginalFilename).toList());
    try {
      return objectMapper.writeValueAsString(snapshot);
    } catch (Exception ex) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }
}
