package com.ssafer.user.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.lang.reflect.Method;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;

final class UserConstraintViolationSupport {

  private static final String EMAIL_CONSTRAINT_NAME = "uk_users_email";
  private static final String DISPLAY_NAME_CONSTRAINT_NAME = "uk_users_active_display_name";

  private UserConstraintViolationSupport() {
  }

  static RuntimeException translateRegistrationException(DataIntegrityViolationException ex) {
    // 회원가입에서는 이메일/닉네임 두 제약을 모두 구분해서 409 비즈니스 예외로 바꾼다.
    if (matchesConstraint(ex, DISPLAY_NAME_CONSTRAINT_NAME)) {
      return new BusinessException(ErrorCode.DUPLICATE_DISPLAY_NAME);
    }
    if (matchesConstraint(ex, EMAIL_CONSTRAINT_NAME)) {
      return new BusinessException(ErrorCode.DUPLICATE_EMAIL);
    }
    return ex;
  }

  static RuntimeException translateProfileUpdateException(DataIntegrityViolationException ex) {
    // 프로필 수정에서는 닉네임 제약만 의미가 있으므로 그 경우만 변환한다.
    if (matchesConstraint(ex, DISPLAY_NAME_CONSTRAINT_NAME)) {
      return new BusinessException(ErrorCode.DUPLICATE_DISPLAY_NAME);
    }
    return ex;
  }

  private static boolean matchesConstraint(Throwable throwable, String constraintName) {
    String normalizedConstraintName = constraintName.toLowerCase(Locale.ROOT);

    // 스프링/하이버네이트/드라이버 예외를 타고 내려가며 constraint name 또는 메시지에 이름이 있는지 확인한다.
    for (Throwable current = throwable; current != null; current = current.getCause()) {
      String extractedConstraintName = extractConstraintName(current);
      if (extractedConstraintName != null
          && extractedConstraintName.toLowerCase(Locale.ROOT).contains(normalizedConstraintName)) {
        return true;
      }

      String message = current.getMessage();
      if (message != null && message.toLowerCase(Locale.ROOT).contains(normalizedConstraintName)) {
        return true;
      }
    }

    return false;
  }

  private static String extractConstraintName(Throwable throwable) {
    try {
      // 예외 타입마다 getConstraintName 유무가 달라서 reflection으로 느슨하게 읽는다.
      Method method = throwable.getClass().getMethod("getConstraintName");
      Object result = method.invoke(throwable);
      if (result instanceof String constraintName) {
        return constraintName;
      }
      return null;
    } catch (ReflectiveOperationException | SecurityException ignored) {
      return null;
    }
  }
}
