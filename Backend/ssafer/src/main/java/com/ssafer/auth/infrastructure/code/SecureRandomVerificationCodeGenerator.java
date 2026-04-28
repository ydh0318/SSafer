package com.ssafer.auth.infrastructure.code;

import com.ssafer.auth.domain.repository.VerificationCodeGenerator;
import java.security.SecureRandom;
import org.springframework.stereotype.Component;

@Component
public class SecureRandomVerificationCodeGenerator implements VerificationCodeGenerator {

  private static final int CODE_LENGTH = 6;

  private final SecureRandom secureRandom = new SecureRandom();

  @Override
  public String generate() {
    // 인증 코드는 숫자 6자리로 고정해 프론트 입력 UX와 메일 본문을 단순하게 유지한다.
    StringBuilder builder = new StringBuilder(CODE_LENGTH);
    for (int index = 0; index < CODE_LENGTH; index++) {
      builder.append(secureRandom.nextInt(10));
    }
    return builder.toString();
  }
}
