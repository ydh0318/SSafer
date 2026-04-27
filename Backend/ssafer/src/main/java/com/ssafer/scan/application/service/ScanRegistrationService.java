package com.ssafer.scan.application.service;

import static com.ssafer.project.domain.enums.ScanMode.AGENT;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.api.dto.CreateScanRequest;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
// 스캔 시작 요청을 프로젝트 매칭/생성 후 scans row로 등록한다.
public class ScanRegistrationService {

  private final ProjectRepository projectRepository;
  private final ScanRepository scanRepository;
  private final ObjectMapper objectMapper;

  @Value("${APP_SCAN_RAW_S3_BUCKET:ssafer}")
  private String rawResultBucket;

  @Transactional
  public ScanRegistrationResult register(AuthenticatedActor actor, CreateScanRequest request) {
    // projectName은 소유자 범위 내 재사용/자동생성 기준이므로 정규화해서 비교한다.
    String normalizedProjectName = normalizeProjectName(request.projectName());
    if (normalizedProjectName == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    // 회원/게스트 소유 범위에서 프로젝트를 찾고, 없으면 새로 만든다.
    Project project = findOrCreateProject(actor, normalizedProjectName);

    LocalDateTime now = LocalDateTime.now();
    // 스캔 시작 시점에는 REQUESTED 상태로 row를 만들고, 요청 스냅샷을 JSON으로 남긴다.
    Scan scan = Scan.builder()
        .projectId(project.getId())
        .requestedByUserId(actor.isMember() ? actor.userId() : null)
        .requestActorType(actor.isMember() ? RequestActorType.USER : RequestActorType.GUEST)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(ScanStatus.REQUESTED)
        .targetSnapshotJson(serializeTargetSnapshot(request))
        .requestedAt(now)
        .lastUpdatedAt(now)
        .build();

    Scan saved = scanRepository.save(scan);
    String rawResultPath = buildRawResultPath(saved.getId());
    // scanId가 생성된 뒤에 고정 규칙(raw/{scanId}/scan_result.json)으로 경로를 채운다.
    scanRepository.updateRawResultPath(saved.getId(), rawResultPath);

    return new ScanRegistrationResult(
        saved.getId(),
        project.getId(),
        saved.getStatus(),
        rawResultPath,
        null
    );
  }

  private Project findOrCreateProject(AuthenticatedActor actor, String normalizedProjectName) {
    Project matched = findProjectByNormalizedName(actor, normalizedProjectName);
    if (matched != null) {
      return matched;
    }

    try {
      // 동일 소유자 범위에서 프로젝트가 없으면 기본 옵션으로 자동 생성한다.
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
      // 동시 요청으로 유니크 충돌이 나면 이미 생성된 프로젝트를 다시 조회해 재사용한다.
      Project reloaded = findProjectByNormalizedName(actor, normalizedProjectName);
      if (reloaded != null) {
        return reloaded;
      }
      throw ignored;
    }
  }

  private Project findProjectByNormalizedName(AuthenticatedActor actor, String normalizedProjectName) {
    // owner scope(회원/게스트) 내부 후보만 가져온 뒤, 동일 정규화 규칙으로 이름을 비교한다.
    List<Project> candidates = actor.isMember()
        ? projectRepository.findByUserIdAndDeletedAtIsNull(actor.userId())
        : projectRepository.findByGuestOwnerKeyHashAndDeletedAtIsNull(actor.guestOwnerKeyHash());

    return candidates.stream()
        .filter(project -> normalizedProjectName.equals(normalizeProjectName(project.getName())))
        .findFirst()
        .orElse(null);
  }

  private String normalizeProjectName(String rawName) {
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

  private String buildRawResultPath(Long scanId) {
    // raw 결과 경로는 팀 합의 규칙으로 고정한다.
    return "s3://" + rawResultBucket + "/raw/" + scanId + "/scan_result.json";
  }

  private String serializeTargetSnapshot(CreateScanRequest request) {
    // 스캔 시작 요청 원문 일부를 저장해 이후 추적/디버깅에 활용한다.
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("source", request.source().name());
    snapshot.put("scanName", request.scanName());
    snapshot.put("targetPath", request.targetPath());
    snapshot.put("includeLogs", request.includeLogs());
    try {
      return objectMapper.writeValueAsString(snapshot);
    } catch (Exception ex) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }
}
