package com.ssafer.user.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
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
    user.updateDisplayName(normalizeDisplayNameOrThrow(displayName));
    return new UserProfileResult(user.getEmail(), user.getDisplayName());
  }

  private User loadCurrentMemberOrThrow(AuthenticatedActor actor) {
    if (actor == null || !actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    return userRepository.findByIdAndAccountStatus(actor.userId(), AccountStatus.ACTIVE)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  private String normalizeDisplayNameOrThrow(String rawDisplayName) {
    if (rawDisplayName == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    String normalized = rawDisplayName.trim();
    if (normalized.isEmpty() || normalized.length() > MAX_DISPLAY_NAME_LENGTH) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return normalized;
  }
}
