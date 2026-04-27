package com.ssafer.global.security;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
// 서비스 계층에서 현재 인증 주체(회원/게스트)를 안전하게 가져오기 위한 헬퍼.
public class CurrentActorProvider {

  public AuthenticatedActor getCurrentActor() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !authentication.isAuthenticated()) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED);
    }

    Object principal = authentication.getPrincipal();
    if (!(principal instanceof AuthenticatedActor actor)) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED);
    }
    return actor;
  }
}
