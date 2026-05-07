package com.ssafer.user.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.ssafer.auth.domain.repository.RefreshTokenStore;
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
import org.springframework.test.util.ReflectionTestUtils;

class UserWithdrawalServiceTest {

  private UserRepository userRepository;
  private RefreshTokenStore refreshTokenStore;
  private UserWithdrawalService userWithdrawalService;

  @BeforeEach
  void setUp() {
    userRepository = Mockito.mock(UserRepository.class);
    refreshTokenStore = Mockito.mock(RefreshTokenStore.class);
    userWithdrawalService = new UserWithdrawalService(userRepository, refreshTokenStore);
  }

  @Test
  void withdrawCurrentUserDeactivatesMemberAndDeletesRefreshToken() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice");
    given(userRepository.findByIdAndAccountStatus(1L, AccountStatus.ACTIVE)).willReturn(Optional.of(user));

    userWithdrawalService.withdrawCurrentUser(AuthenticatedActor.member(1L));

    assertThat(user.getAccountStatus()).isEqualTo(AccountStatus.INACTIVE);
    assertThat(user.getPasswordHash()).isEqualTo("encoded-password");
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
}
