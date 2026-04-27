package com.ssafer.project.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.project.domain.repository.ProjectRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
/**
 * 프로젝트 CRUD 비즈니스 규칙을 담당한다.
 * - 회원/게스트 소유자 분기
 * - 입력 정규화(trim) 및 검증
 * - soft delete 기준 조회/삭제
 */
public class ProjectManagementService {

  private static final int DEFAULT_PAGE = 0;
  private static final int DEFAULT_SIZE = 20;
  private static final int MAX_SIZE = 100;
  private static final int MAX_NAME_LENGTH = 255;
  private static final int MAX_DESCRIPTION_LENGTH = 1000;

  private final ProjectRepository projectRepository;
  private final ProjectAuthorizationService projectAuthorizationService;

  public ProjectManagementService(
      ProjectRepository projectRepository,
      ProjectAuthorizationService projectAuthorizationService
  ) {
    this.projectRepository = projectRepository;
    this.projectAuthorizationService = projectAuthorizationService;
  }

  @Transactional
  public Long createProject(
      AuthenticatedActor actor,
      String rawName,
      String rawDescription,
      ScanMode defaultScanMode,
      Boolean monitorEnabled
  ) {
    // 생성 시 name/description 정규화 및 길이 검증을 동일 규칙으로 적용한다.
    String name = normalizeNameOrThrow(rawName);
    String description = normalizeDescriptionOrThrow(rawDescription);

    // 요청 누락 시 명세 기본값을 적용한다.
    ScanMode scanMode = defaultScanMode == null ? ScanMode.AGENT : defaultScanMode;
    boolean monitor = monitorEnabled != null && monitorEnabled;

    // 회원은 user_id, 게스트는 guest_owner_key_hash를 저장한다.
    Long userId = actor.isMember() ? actor.userId() : null;
    String guestOwnerKeyHash = actor.isGuest() ? actor.guestOwnerKeyHash() : null;

    Project project = new Project(
        userId,
        guestOwnerKeyHash,
        name,
        description,
        scanMode,
        monitor
    );
    Project saved = projectRepository.save(project);
    return saved.getId();
  }

  @Transactional(readOnly = true)
  public Project getProjectDetail(AuthenticatedActor actor, Long projectId) {
    return projectAuthorizationService.loadAuthorizedProjectOrThrow(projectId, actor);
  }

  @Transactional(readOnly = true)
  public Page<Project> getProjects(AuthenticatedActor actor, Integer page, Integer size) {
    int normalizedPage = page == null ? DEFAULT_PAGE : page;
    int normalizedSize = size == null ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

    if (normalizedPage < 0 || normalizedSize < 1) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    Pageable pageable = PageRequest.of(
        normalizedPage,
        normalizedSize,
        Sort.by(Sort.Direction.DESC, "createdAt")
    );

    // 목록도 요청자 소유 범위로만 제한한다.
    if (actor.isMember()) {
      return projectRepository.findByUserIdAndDeletedAtIsNull(actor.userId(), pageable);
    }
    return projectRepository.findByGuestOwnerKeyHashAndDeletedAtIsNull(actor.guestOwnerKeyHash(), pageable);
  }

  @Transactional
  public Long updateProject(
      AuthenticatedActor actor,
      Long projectId,
      boolean nameProvided,
      String rawName,
      boolean descriptionProvided,
      String rawDescription,
      boolean defaultScanModeProvided,
      ScanMode defaultScanMode,
      boolean monitorEnabledProvided,
      Boolean monitorEnabled
  ) {
    // PATCH는 "포함된 필드가 하나도 없으면" 수정 요청으로 보지 않는다.
    if (!nameProvided && !descriptionProvided && !defaultScanModeProvided && !monitorEnabledProvided) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    Project project = projectAuthorizationService.loadAuthorizedProjectOrThrow(projectId, actor);

    String name = nameProvided ? normalizeNameOrThrow(rawName) : null;
    // description은 명시적으로 null을 보낸 경우에만 null로 반영한다.
    String description = descriptionProvided ? normalizeDescriptionOrThrow(rawDescription) : null;
    ScanMode scanMode = defaultScanModeProvided ? requireNonNull(defaultScanMode) : null;
    Boolean monitor = monitorEnabledProvided ? requireNonNull(monitorEnabled) : null;

    project.update(
        nameProvided,
        name,
        descriptionProvided,
        description,
        defaultScanModeProvided,
        scanMode,
        monitorEnabledProvided,
        monitor
    );
    return project.getId();
  }

  @Transactional
  public void deleteProject(AuthenticatedActor actor, Long projectId) {
    Project project = projectAuthorizationService.loadAuthorizedProjectOrThrow(projectId, actor);
    // 삭제 API는 soft delete만 수행한다.
    project.softDelete();
  }

  private String normalizeNameOrThrow(String rawName) {
    if (rawName == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    String normalized = rawName.trim();
    if (normalized.isEmpty() || normalized.length() > MAX_NAME_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return normalized;
  }

  private String normalizeDescriptionOrThrow(String rawDescription) {
    if (rawDescription == null) {
      return null;
    }

    String normalized = rawDescription.trim();
    if (normalized.isEmpty()) {
      return null;
    }
    if (normalized.length() > MAX_DESCRIPTION_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return normalized;
  }

  private <T> T requireNonNull(T value) {
    if (value == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return value;
  }
}
