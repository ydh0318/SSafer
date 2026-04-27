package com.ssafer.project.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.project.domain.repository.ProjectRepository;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

class ProjectManagementServiceTest {

  private ProjectRepository projectRepository;
  private ProjectAuthorizationService projectAuthorizationService;
  private ProjectManagementService projectManagementService;

  @BeforeEach
  void setUp() {
    projectRepository = Mockito.mock(ProjectRepository.class);
    projectAuthorizationService = Mockito.mock(ProjectAuthorizationService.class);
    projectManagementService = new ProjectManagementService(projectRepository, projectAuthorizationService);
  }

  @Test
  void createProjectAppliesDefaultsAndTrimmingForMember() {
    Project saved = new Project(1L, null, "Project A", null, ScanMode.AGENT, false);
    given(projectRepository.save(any(Project.class))).willReturn(saved);

    projectManagementService.createProject(
        AuthenticatedActor.member(1L),
        "  Project A  ",
        "   ",
        null,
        null
    );

    ArgumentCaptor<Project> projectCaptor = ArgumentCaptor.forClass(Project.class);
    then(projectRepository).should().save(projectCaptor.capture());
    Project captured = projectCaptor.getValue();

    assertThat(captured.getUserId()).isEqualTo(1L);
    assertThat(captured.getGuestOwnerKeyHash()).isNull();
    assertThat(captured.getName()).isEqualTo("Project A");
    assertThat(captured.getDescription()).isNull();
    assertThat(captured.getDefaultScanMode()).isEqualTo(ScanMode.AGENT);
    assertThat(captured.isMonitorEnabled()).isFalse();
  }

  @Test
  void createProjectStoresGuestOwnerHashForGuest() {
    Project saved = new Project(null, "hash-1", "Project A", null, ScanMode.AGENT, false);
    given(projectRepository.save(any(Project.class))).willReturn(saved);

    projectManagementService.createProject(
        AuthenticatedActor.guest("hash-1"),
        "Project A",
        null,
        ScanMode.UPLOAD,
        true
    );

    ArgumentCaptor<Project> projectCaptor = ArgumentCaptor.forClass(Project.class);
    then(projectRepository).should().save(projectCaptor.capture());
    Project captured = projectCaptor.getValue();

    assertThat(captured.getUserId()).isNull();
    assertThat(captured.getGuestOwnerKeyHash()).isEqualTo("hash-1");
    assertThat(captured.getDefaultScanMode()).isEqualTo(ScanMode.UPLOAD);
    assertThat(captured.isMonitorEnabled()).isTrue();
  }

  @Test
  void getProjectsClampsSizeToMaxHundred() {
    given(projectRepository.findByUserIdAndDeletedAtIsNull(
        Mockito.eq(1L),
        any(Pageable.class)
    )).willReturn(new PageImpl<>(java.util.List.of()));

    projectManagementService.getProjects(AuthenticatedActor.member(1L), 0, 999);

    ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
    then(projectRepository).should().findByUserIdAndDeletedAtIsNull(Mockito.eq(1L), pageableCaptor.capture());
    assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(100);
  }

  @Test
  void updateProjectThrowsInvalidParameterWhenNoFieldsProvided() {
    assertThatThrownBy(() -> projectManagementService.updateProject(
        AuthenticatedActor.member(1L),
        10L,
        false,
        null,
        false,
        null,
        false,
        null,
        false,
        null
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void updateProjectAllowsDescriptionToBeClearedAsNull() {
    Project project = new Project(1L, null, "Project A", "desc", ScanMode.AGENT, false);
    given(projectAuthorizationService.loadAuthorizedProjectOrThrow(10L, AuthenticatedActor.member(1L)))
        .willReturn(project);

    Long projectId = projectManagementService.updateProject(
        AuthenticatedActor.member(1L),
        10L,
        false,
        null,
        true,
        null,
        false,
        null,
        false,
        null
    );

    assertThat(projectId).isEqualTo(project.getId());
    assertThat(project.getDescription()).isNull();
  }

  @Test
  void updateProjectDoesNotChangeDescriptionWhenDescriptionIsNotProvided() {
    Project project = new Project(1L, null, "Project A", "desc", ScanMode.AGENT, false);
    given(projectAuthorizationService.loadAuthorizedProjectOrThrow(10L, AuthenticatedActor.member(1L)))
        .willReturn(project);

    projectManagementService.updateProject(
        AuthenticatedActor.member(1L),
        10L,
        true,
        "Project B",
        false,
        null,
        false,
        null,
        false,
        null
    );

    assertThat(project.getName()).isEqualTo("Project B");
    assertThat(project.getDescription()).isEqualTo("desc");
  }

  @Test
  void deleteProjectMarksDeletedAt() {
    Project project = new Project(1L, null, "Project A", "desc", ScanMode.AGENT, false);
    given(projectAuthorizationService.loadAuthorizedProjectOrThrow(10L, AuthenticatedActor.member(1L)))
        .willReturn(project);

    projectManagementService.deleteProject(AuthenticatedActor.member(1L), 10L);

    assertThat(project.getDeletedAt()).isBeforeOrEqualTo(Instant.now());
  }
}
