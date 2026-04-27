package com.ssafer.project.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.project.domain.repository.ProjectRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ProjectAuthorizationServiceTest {

  private ProjectRepository projectRepository;
  private ProjectAuthorizationService projectAuthorizationService;

  @BeforeEach
  void setUp() {
    projectRepository = Mockito.mock(ProjectRepository.class);
    projectAuthorizationService = new ProjectAuthorizationService(projectRepository);
  }

  @Test
  void loadAuthorizedProjectForMemberSuccess() {
    Project project = new Project(1L, null, "proj", null, ScanMode.AGENT, false);
    given(projectRepository.findByIdAndDeletedAtIsNull(10L)).willReturn(Optional.of(project));

    Project found = projectAuthorizationService.loadAuthorizedProjectOrThrow(
        10L,
        AuthenticatedActor.member(1L)
    );

    assertThat(found).isSameAs(project);
  }

  @Test
  void loadAuthorizedProjectForGuestSuccess() {
    Project project = new Project(null, "hash-1", "proj", null, ScanMode.AGENT, false);
    given(projectRepository.findByIdAndDeletedAtIsNull(10L)).willReturn(Optional.of(project));

    Project found = projectAuthorizationService.loadAuthorizedProjectOrThrow(
        10L,
        AuthenticatedActor.guest("hash-1")
    );

    assertThat(found).isSameAs(project);
  }

  @Test
  void loadAuthorizedProjectForbiddenWhenOwnerMismatch() {
    Project project = new Project(1L, null, "proj", null, ScanMode.AGENT, false);
    given(projectRepository.findByIdAndDeletedAtIsNull(10L)).willReturn(Optional.of(project));

    assertThatThrownBy(() -> projectAuthorizationService.loadAuthorizedProjectOrThrow(
        10L,
        AuthenticatedActor.member(2L)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  @Test
  void loadAuthorizedProjectNotFoundWhenDeletedOrMissing() {
    given(projectRepository.findByIdAndDeletedAtIsNull(10L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> projectAuthorizationService.loadAuthorizedProjectOrThrow(
        10L,
        AuthenticatedActor.member(1L)
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }
}
