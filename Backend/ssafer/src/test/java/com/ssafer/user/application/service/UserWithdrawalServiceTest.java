package com.ssafer.user.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.repository.RefreshTokenStore;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.application.service.ScanStatusSseEmitterRegistry;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.repository.ScanRepository;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

class UserWithdrawalServiceTest {

  private UserRepository userRepository;
  private ProjectRepository projectRepository;
  private ScanRepository scanRepository;
  private ScanStatusSseEmitterRegistry scanStatusSseEmitterRegistry;
  private RefreshTokenStore refreshTokenStore;
  private UserWithdrawalService userWithdrawalService;

  @BeforeEach
  void setUp() {
    userRepository = Mockito.mock(UserRepository.class);
    projectRepository = Mockito.mock(ProjectRepository.class);
    scanRepository = Mockito.mock(ScanRepository.class);
    scanStatusSseEmitterRegistry = Mockito.mock(ScanStatusSseEmitterRegistry.class);
    refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    userWithdrawalService = new UserWithdrawalService(
        userRepository,
        projectRepository,
        scanRepository,
        scanStatusSseEmitterRegistry,
        refreshTokenStore
    );
  }

  @Test
  void withdrawCurrentUserDeactivatesMemberSoftDeletesProjectsAndScansClearsSseAndDeletesRefreshToken() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice");
    Project firstProject = new Project(1L, null, "Project A", null, ScanMode.AGENT, false);
    Project secondProject = new Project(1L, null, "Project B", null, ScanMode.UPLOAD, false);
    ReflectionTestUtils.setField(firstProject, "id", 101L);
    ReflectionTestUtils.setField(secondProject, "id", 102L);
    Scan firstScan = createScan(1001L, 101L);
    Scan secondScan = createScan(1002L, 102L);
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.of(user));
    given(projectRepository.findByUserIdAndDeletedAtIsNull(1L)).willReturn(List.of(firstProject, secondProject));
    given(scanRepository.findByProjectIdAndDeletedAtIsNull(101L)).willReturn(List.of(firstScan));
    given(scanRepository.findByProjectIdAndDeletedAtIsNull(102L)).willReturn(List.of(secondScan));

    userWithdrawalService.withdrawCurrentUser(AuthenticatedActor.member(1L));

    assertThat(user.getAccountStatus()).isEqualTo(AccountStatus.INACTIVE);
    assertThat(user.getPasswordHash()).isNull();
    assertThat(user.hasPasswordCredential()).isFalse();
    assertThat(firstProject.getDeletedAt()).isNotNull();
    assertThat(secondProject.getDeletedAt()).isNotNull();
    assertThat(firstScan.getDeletedAt()).isNotNull();
    assertThat(secondScan.getDeletedAt()).isNotNull();
    then(scanStatusSseEmitterRegistry).should().removeAll(AuthenticatedActor.member(1L));
    then(refreshTokenStore).should().delete(1L);
  }

  @Test
  void withdrawCurrentUserThrowsForbiddenForGuest() {
    assertThatThrownBy(() -> userWithdrawalService.withdrawCurrentUser(AuthenticatedActor.guest("guest-hash")))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  @Test
  void withdrawCurrentUserThrowsNotFoundWhenUserDoesNotExist() {
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.empty());

    assertThatThrownBy(() -> userWithdrawalService.withdrawCurrentUser(AuthenticatedActor.member(1L)))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  private User createUser(Long userId, String email, String displayName) {
    User user = new User(email, displayName, "encoded-password", AccountStatus.ACTIVE);
    ReflectionTestUtils.setField(user, "id", userId);
    return user;
  }

  private Scan createScan(Long scanId, Long projectId) {
    Scan scan = Scan.builder()
        .projectId(projectId)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.RUNNING)
        .requestedAt(LocalDateTime.now())
        .lastUpdatedAt(LocalDateTime.now())
        .build();
    ReflectionTestUtils.setField(scan, "id", scanId);
    return scan;
  }
}
