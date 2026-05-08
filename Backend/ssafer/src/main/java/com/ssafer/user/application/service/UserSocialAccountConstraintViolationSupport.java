package com.ssafer.user.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.lang.reflect.Method;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;

final class UserSocialAccountConstraintViolationSupport {

  private static final String USER_PROVIDER_CONSTRAINT_NAME = "uk_user_social_accounts_user_provider";
  private static final String PROVIDER_USER_ID_CONSTRAINT_NAME = "uk_user_social_accounts_provider_user_id";

  private UserSocialAccountConstraintViolationSupport() {
  }

  static RuntimeException translateLinkException(DataIntegrityViolationException ex) {
    if (matchesConstraint(ex, USER_PROVIDER_CONSTRAINT_NAME)
        || matchesConstraint(ex, PROVIDER_USER_ID_CONSTRAINT_NAME)) {
      return new BusinessException(ErrorCode.SOCIAL_ACCOUNT_ALREADY_LINKED);
    }
    return ex;
  }

  private static boolean matchesConstraint(Throwable throwable, String constraintName) {
    String normalizedConstraintName = constraintName.toLowerCase(Locale.ROOT);

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
