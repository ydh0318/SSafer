package com.ssafer.user.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

class UserProfileServiceTest {

  private UserRepository userRepository;
  private UserProfileService userProfileService;

  @BeforeEach
  void setUp() {
    userRepository = Mockito.mock(UserRepository.class);
    userProfileService = new UserProfileService(userRepository);
  }

  @Test
  void getCurrentUserProfileReturnsMemberProfile() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice");
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.of(user));

    UserProfileResult result = userProfileService.getCurrentUserProfile(AuthenticatedActor.member(1L));

    assertThat(result.email()).isEqualTo("user@ssafer.co.kr");
    assertThat(result.displayName()).isEqualTo("Alice");
  }

  @Test
  void updateCurrentUserProfileChangesDisplayName() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice");
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.of(user));
    given(userRepository.existsByDisplayNameAndAccountStatusAndIdNot("Alice Updated", AccountStatus.ACTIVE, 1L))
        .willReturn(false);

    UserProfileResult result = userProfileService.updateCurrentUserProfile(
        AuthenticatedActor.member(1L),
        "  Alice Updated  "
    );

    assertThat(result.email()).isEqualTo("user@ssafer.co.kr");
    assertThat(result.displayName()).isEqualTo("Alice Updated");
    assertThat(user.getDisplayName()).isEqualTo("Alice Updated");
  }

  @Test
  void getCurrentUserProfileThrowsForbiddenForGuest() {
    assertThatThrownBy(() -> userProfileService.getCurrentUserProfile(AuthenticatedActor.guest("guest-hash")))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  @Test
  void updateCurrentUserProfileThrowsNotFoundWhenUserDoesNotExist() {
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.empty());

    assertThatThrownBy(() -> userProfileService.updateCurrentUserProfile(
        AuthenticatedActor.member(1L),
        "Alice Updated"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void updateCurrentUserProfileThrowsInvalidParameterWhenDisplayNameIsBlank() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice");
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.of(user));

    assertThatThrownBy(() -> userProfileService.updateCurrentUserProfile(
        AuthenticatedActor.member(1L),
        " "
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void updateCurrentUserProfileThrowsDuplicateDisplayNameWhenAlreadyUsedByAnotherActiveUser() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice");
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.of(user));
    given(userRepository.existsByDisplayNameAndAccountStatusAndIdNot("Alice Updated", AccountStatus.ACTIVE, 1L))
        .willReturn(true);

    assertThatThrownBy(() -> userProfileService.updateCurrentUserProfile(
        AuthenticatedActor.member(1L),
        "Alice Updated"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.DUPLICATE_DISPLAY_NAME);
  }

  @Test
  void updateCurrentUserProfileTranslatesUniqueConstraintViolationToDuplicateDisplayName() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice");
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.of(user));
    given(userRepository.existsByDisplayNameAndAccountStatusAndIdNot("Alice Updated", AccountStatus.ACTIVE, 1L))
        .willReturn(false);
    Mockito.doThrow(
        new DataIntegrityViolationException(
            "duplicate key value violates unique constraint \"uk_users_active_display_name\""
        )
    ).when(userRepository).flush();

    assertThatThrownBy(() -> userProfileService.updateCurrentUserProfile(
        AuthenticatedActor.member(1L),
        "Alice Updated"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.DUPLICATE_DISPLAY_NAME);
  }

  private User createUser(Long userId, String email, String displayName) {
    User user = new User(email, displayName, "encoded-password", AccountStatus.ACTIVE);
    ReflectionTestUtils.setField(user, "id", userId);
    return user;
  }
}
