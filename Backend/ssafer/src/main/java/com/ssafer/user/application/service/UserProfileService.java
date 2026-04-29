package com.ssafer.user.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserProfileService {

  private static final int MAX_DISPLAY_NAME_LENGTH = 100;

  private final UserRepository userRepository;

  public UserProfileService(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  @Transactional(readOnly = true)
  public UserProfileResult getCurrentUserProfile(AuthenticatedActor actor) {
    User user = loadCurrentMemberOrThrow(actor);
    return new UserProfileResult(user.getEmail(), user.getDisplayName());
  }

  @Transactional
  public UserProfileResult updateCurrentUserProfile(AuthenticatedActor actor, String displayName) {
    User user = loadCurrentMemberOrThrow(actor);
    // 사용자 설정 수정 API는 현재 태스크 범위에서 displayName 하나만 반영한다.
    user.updateDisplayName(normalizeDisplayNameOrThrow(displayName));
    return new UserProfileResult(user.getEmail(), user.getDisplayName());
  }

  private User loadCurrentMemberOrThrow(AuthenticatedActor actor) {
    // 사용자 설정 화면은 회원 전용 기능이라 게스트 요청은 막는다.
    if (actor == null || !actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    return userRepository.findById(actor.userId())
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  private String normalizeDisplayNameOrThrow(String rawDisplayName) {
    if (rawDisplayName == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    String normalized = rawDisplayName.trim();
    // DTO 검증이 있더라도 서비스 계층에서도 공백/길이 정책을 한 번 더 방어한다.
    if (normalized.isEmpty() || normalized.length() > MAX_DISPLAY_NAME_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return normalized;
  }
}
