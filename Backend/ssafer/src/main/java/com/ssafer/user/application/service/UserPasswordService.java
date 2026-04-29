package com.ssafer.user.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserPasswordService {

  private static final int MIN_PASSWORD_LENGTH = 8;
  private static final int MAX_PASSWORD_LENGTH = 72;

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;

  public UserPasswordService(
      UserRepository userRepository,
      PasswordEncoder passwordEncoder
  ) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
  }

  @Transactional
  public void changePassword(AuthenticatedActor actor, String rawCurrentPassword, String rawNewPassword) {
    User user = loadCurrentMemberOrThrow(actor);
    String currentPassword = normalizePasswordOrThrow(rawCurrentPassword);
    String newPassword = normalizePasswordOrThrow(rawNewPassword);
    String passwordHash = user.getPasswordHash();

    // 비밀번호 변경 API도 현재 비밀번호가 맞는 본인 요청만 허용한다.
    if (passwordHash == null || passwordHash.isBlank() || !passwordEncoder.matches(currentPassword, passwordHash)) {
      throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
    }

    user.updatePasswordHash(passwordEncoder.encode(newPassword));
  }

  private User loadCurrentMemberOrThrow(AuthenticatedActor actor) {
    // 비밀번호 변경은 회원 전용 기능이라 게스트 요청은 차단한다.
    if (actor == null || !actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    return userRepository.findById(actor.userId())
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  private String normalizePasswordOrThrow(String rawPassword) {
    if (rawPassword == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    // 비밀번호는 공백을 의미 있는 문자로 볼 수 있어 trim하지 않고 길이/blank만 검사한다.
    if (rawPassword.isBlank()
        || rawPassword.length() < MIN_PASSWORD_LENGTH
        || rawPassword.length() > MAX_PASSWORD_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return rawPassword;
  }
}
