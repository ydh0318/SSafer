package com.ssafer.user.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
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
    String normalizedDisplayName = normalizeDisplayNameOrThrow(displayName);
    // 같은 사용자는 제외하고, 다른 활성 사용자가 이미 쓰는 닉네임인지 먼저 확인한다.
    ensureDisplayNameAvailableForUpdate(normalizedDisplayName, user.getId());

    try {
      user.updateDisplayName(normalizedDisplayName);
      userRepository.flush();
      return new UserProfileResult(user.getEmail(), user.getDisplayName());
    } catch (DataIntegrityViolationException ex) {
      // 동시 수정 충돌은 DB 제약 이름을 보고 닉네임 중복으로 변환한다.
      throw UserConstraintViolationSupport.translateProfileUpdateException(ex);
    }
  }

  private User loadCurrentMemberOrThrow(AuthenticatedActor actor) {
    // 게스트는 회원 전용 프로필 API에 접근할 수 없다.
    if (actor == null || !actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    return userRepository.findByIdAndAccountStatus(actor.userId(), AccountStatus.ACTIVE)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  private void ensureDisplayNameAvailableForUpdate(String displayName, Long userId) {
    if (userRepository.existsByDisplayNameAndAccountStatusAndIdNot(displayName, AccountStatus.ACTIVE, userId)) {
      throw new BusinessException(ErrorCode.DUPLICATE_DISPLAY_NAME);
    }
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
