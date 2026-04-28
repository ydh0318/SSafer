package com.ssafer.user.infrastructure.bootstrap;

import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
public class LocalUserSeedInitializer implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(LocalUserSeedInitializer.class);
  private static final String TEST_USER_EMAIL = "test@ssafer.co.kr";
  private static final String TEST_USER_DISPLAY_NAME = "localTester";
  private static final String TEST_USER_PASSWORD = "password123!";

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;

  public LocalUserSeedInitializer(
      UserRepository userRepository,
      PasswordEncoder passwordEncoder
  ) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
  }

  @Override
  public void run(ApplicationArguments args) {
    // local 프로필에서는 테스트 계정을 자동 생성해서 반복 회원가입 없이 바로 로그인 테스트할 수 있게 한다.
    if (userRepository.existsByEmail(TEST_USER_EMAIL)) {
      return;
    }

    User user = new User(
        TEST_USER_EMAIL,
        TEST_USER_DISPLAY_NAME,
        passwordEncoder.encode(TEST_USER_PASSWORD),
        AccountStatus.ACTIVE
    );

    userRepository.save(user);
    log.info("Local test user seeded. email={}", TEST_USER_EMAIL);
  }
}
