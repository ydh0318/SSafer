package com.ssafer.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
        // 회원/권한 기능을 아직 붙이지 않은 단계라 Swagger와 내부 API 테스트를 위해 전부 허용한다.
        .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
        // Swagger의 Try it out 과 내부 콜백 POST를 바로 테스트할 수 있게 CSRF를 끈다.
        .csrf(csrf -> csrf.disable())
        // 기본 로그인 페이지가 뜨지 않도록 폼 로그인과 HTTP Basic을 비활성화한다.
        .formLogin(form -> form.disable())
        .httpBasic(basic -> basic.disable())
        .logout(logout -> logout.disable())
        .build();
  }
}
