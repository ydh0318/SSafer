package com.ssafer.user.application.service;

import com.ssafer.auth.domain.repository.RefreshTokenStore;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.application.service.ScanStatusSseEmitterRegistry;
import com.ssafer.scan.domain.repository.ScanRepository;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserWithdrawalService {

  private final UserRepository userRepository;
  private final ProjectRepository projectRepository;
  private final ScanRepository scanRepository;
  private final ScanStatusSseEmitterRegistry scanStatusSseEmitterRegistry;
  private final RefreshTokenStore refreshTokenStore;

  public UserWithdrawalService(
      UserRepository userRepository,
      ProjectRepository projectRepository,
      ScanRepository scanRepository,
      ScanStatusSseEmitterRegistry scanStatusSseEmitterRegistry,
      RefreshTokenStore refreshTokenStore
  ) {
    this.userRepository = userRepository;
    this.projectRepository = projectRepository;
    this.scanRepository = scanRepository;
    this.scanStatusSseEmitterRegistry = scanStatusSseEmitterRegistry;
    this.refreshTokenStore = refreshTokenStore;
  }

  @Transactional
  public void withdrawCurrentUser(AuthenticatedActor actor) {
    User user = loadCurrentMemberOrThrow(actor);
    projectRepository.findByUserIdAndDeletedAtIsNull(user.getId())
        .forEach(project -> {
          scanRepository.findByProjectIdAndDeletedAtIsNull(project.getId())
              .forEach(scan -> scan.softDelete());
          project.softDelete();
        });
    scanStatusSseEmitterRegistry.removeAll(AuthenticatedActor.member(user.getId()));
    user.invalidateAccessTokens(Instant.now());
    user.deactivate();
    refreshTokenStore.delete(user.getId());
  }

  private User loadCurrentMemberOrThrow(AuthenticatedActor actor) {
    if (actor == null || !actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    return userRepository.findByIdAndAccountStatus(actor.userId(), AccountStatus.ACTIVE)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }
}
