package com.ssafer.scan.application.service;

import static com.ssafer.project.domain.enums.ScanMode.AGENT;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class UploadScanService {

  private final CurrentActorProvider currentActorProvider;
  private final ProjectRepository projectRepository;
  private final UploadScanFileValidator uploadScanFileValidator;
  private final ScanExecutionPermit scanExecutionPermit;
  private final ScanRepository scanRepository;
  private final WebUploadScanProcessor webUploadScanProcessor;
  private final ObjectMapper objectMapper;

  public UploadScanResult requestUploadScan(String projectName, String scanName, List<MultipartFile> files) {
    // projectName 기준으로 프로젝트를 find-or-create 하고 업로드 처리 파이프라인을 수행한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    String normalizedProjectName = normalizeProjectName(projectName);
    if (normalizedProjectName == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    Project project = findOrCreateProject(actor, normalizedProjectName);
    uploadScanFileValidator.validate(files);

    boolean acquired = scanExecutionPermit.tryAcquire();
    if (!acquired) {
      throw new BusinessException(ErrorCode.SCAN_EXECUTION_BUSY);
    }

    try {
      Scan saved = scanRepository.save(buildRequestedScan(actor, project.getId(), scanName, files));
      // scan_result.json에 실제 프로젝트 이름이 기록되도록 command에 함께 전달한다.
      UploadScanProcessingResult processingResult = webUploadScanProcessor.process(
          new UploadScanProcessingCommand(
              saved.getId(),
              project.getId(),
              project.getName(),
              scanName,
              List.copyOf(files)
          )
      );

      return new UploadScanResult(
          saved.getId(),
          processingResult.status(),
          processingResult.failureReason(),
          processingResult.errorCode()
      );
    } finally {
      scanExecutionPermit.release();
    }
  }

  private Project findOrCreateProject(AuthenticatedActor actor, String normalizedProjectName) {
    // 동일 소유 범위 내 같은 이름 프로젝트가 있으면 재사용한다.
    Project matched = findProjectByNormalizedName(actor, normalizedProjectName);
    if (matched != null) {
      return matched;
    }

    try {
      // 없으면 새 프로젝트를 생성한다.
      Project created = new Project(
          actor.isMember() ? actor.userId() : null,
          actor.isGuest() ? actor.guestOwnerKeyHash() : null,
          normalizedProjectName,
          null,
          AGENT,
          false
      );
      return projectRepository.save(created);
    } catch (DataIntegrityViolationException ignored) {
      // 동시 요청으로 유니크 충돌이 나면 재조회해서 기존 생성 건을 사용한다.
      Project reloaded = findProjectByNormalizedName(actor, normalizedProjectName);
      if (reloaded != null) {
        return reloaded;
      }
      throw ignored;
    }
  }

  private Project findProjectByNormalizedName(AuthenticatedActor actor, String normalizedProjectName) {
    // 요청자 타입(USER/GUEST)에 따라 소유 범위를 분리해 프로젝트를 조회한다.
    List<Project> candidates = actor.isMember()
        ? projectRepository.findByUserIdAndDeletedAtIsNull(actor.userId())
        : projectRepository.findByGuestOwnerKeyHashAndDeletedAtIsNull(actor.guestOwnerKeyHash());

    return candidates.stream()
        .filter(project -> normalizedProjectName.equals(normalizeProjectName(project.getName())))
        .findFirst()
        .orElse(null);
  }

  private String normalizeProjectName(String rawName) {
    // 이름 정규화 규칙: trim + 연속 공백 축소 + 소문자 변환
    if (rawName == null) {
      return null;
    }
    String trimmed = rawName.trim();
    if (trimmed.isEmpty()) {
      return null;
    }
    String collapsed = trimmed.replaceAll("\\s+", " ");
    return collapsed.toLowerCase(Locale.ROOT);
  }

  private Scan buildRequestedScan(
      AuthenticatedActor actor,
      Long projectId,
      String scanName,
      List<MultipartFile> files
  ) {
    // 업로드 요청은 scanMode=UPLOAD, status=REQUESTED로 생성한다.
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
    // 추적용 최소 메타데이터만 snapshot JSON으로 저장한다.
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
