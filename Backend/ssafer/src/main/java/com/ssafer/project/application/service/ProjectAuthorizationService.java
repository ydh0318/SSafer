package com.ssafer.project.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.repository.ProjectRepository;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
/**
 * 프로젝트 리소스 접근 권한을 공통으로 처리하는 서비스.
 * 삭제된 리소스는 NOT_FOUND, 소유자가 아니면 FORBIDDEN을 던진다.
 */
public class ProjectAuthorizationService {

  private final ProjectRepository projectRepository;

  public ProjectAuthorizationService(ProjectRepository projectRepository) {
    this.projectRepository = projectRepository;
  }

  public Project loadActiveProjectOrThrow(Long projectId) {
    // soft delete된 데이터는 조회 대상에서 제외한다.
    return projectRepository.findByIdAndDeletedAtIsNull(projectId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  public Project loadAuthorizedProjectOrThrow(Long projectId, AuthenticatedActor actor) {
    Project project = loadActiveProjectOrThrow(projectId);
    assertOwner(project, actor);
    return project;
  }

  public void assertOwner(Project project, AuthenticatedActor actor) {
    // 회원: project.user_id == token.sub
    // 게스트: project.guest_owner_key_hash == token.guestOwnerKeyHash
    boolean authorized = actor.isMember()
        ? Objects.equals(project.getUserId(), actor.userId())
        : Objects.equals(project.getGuestOwnerKeyHash(), actor.guestOwnerKeyHash());

    if (!authorized) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }
  }
}
