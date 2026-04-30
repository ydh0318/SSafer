package com.ssafer.user.application.service;

import com.ssafer.auth.domain.repository.RefreshTokenStore;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserWithdrawalService {

  private final UserRepository userRepository;
  private final RefreshTokenStore refreshTokenStore;

  public UserWithdrawalService(
      UserRepository userRepository,
      RefreshTokenStore refreshTokenStore
  ) {
    this.userRepository = userRepository;
    this.refreshTokenStore = refreshTokenStore;
  }

  @Transactional
  public void withdrawCurrentUser(AuthenticatedActor actor) {
    User user = loadCurrentMemberOrThrow(actor);
    // 탈퇴 시 계정은 비활성화하고, 세션 연장을 막기 위해 refresh token을 제거한다.
    user.deactivate();
    refreshTokenStore.delete(user.getId());
  }

  private User loadCurrentMemberOrThrow(AuthenticatedActor actor) {
    // 탈퇴는 회원 전용 기능이므로 게스트 요청은 금지한다.
    if (actor == null || !actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    return userRepository.findByIdAndAccountStatus(actor.userId(), AccountStatus.ACTIVE)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }
}
