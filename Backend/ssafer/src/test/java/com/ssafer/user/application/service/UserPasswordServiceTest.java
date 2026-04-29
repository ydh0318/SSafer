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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class UserPasswordServiceTest {

  private UserRepository userRepository;
  private PasswordEncoder passwordEncoder;
  private UserPasswordService userPasswordService;

  @BeforeEach
  void setUp() {
    userRepository = Mockito.mock(UserRepository.class);
    passwordEncoder = Mockito.mock(PasswordEncoder.class);
    userPasswordService = new UserPasswordService(userRepository, passwordEncoder);
  }

  @Test
  void changePasswordUpdatesPasswordHashForMember() {
    User user = createUser(1L, "user@ssafer.co.kr", "Alice", "encoded-old-password");
    given(userRepository.findById(1L)).willReturn(Optional.of(user));
    given(passwordEncoder.matches("password123", "encoded-old-password")).willReturn(true);
    given(passwordEncoder.encode("new-password123")).willReturn("encoded-new-password");

    userPasswordService.changePassword(
        AuthenticatedActor.member(1L),
        "password123",
        "new-password123"
    );

    assertThat(user.getPasswordHash()).isEqualTo("encoded-new-password");
  }

  @Test
  void changePasswordThrowsForbiddenForGuest() {
    assertThatThrownBy(() -> userPasswordService.changePassword(
        AuthenticatedActor.guest("guest-hash"),
        "password123",
        "new-password123"
    ))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }

  private User createUser(Long userId, String email, String displayName, String passwordHash) {
    User user = new User(email, displayName, passwordHash, AccountStatus.ACTIVE);
    ReflectionTestUtils.setField(user, "id", userId);
    return user;
  }
}
