package com.ssafer.global.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
/**
 * 프로젝트 API 인증/인가의 진입 설정.
 * - 세션 미사용(stateless)
 * - /api/v1/projects/** 인증 필수
 * - JWT 필터를 기본 인증 필터 앞에 배치
 */
public class SecurityConfig {

  private final JwtAuthenticationFilter jwtAuthenticationFilter;
  private final ApiAuthenticationEntryPoint apiAuthenticationEntryPoint;
  private final ApiAccessDeniedHandler apiAccessDeniedHandler;

  public SecurityConfig(
      JwtAuthenticationFilter jwtAuthenticationFilter,
      ApiAuthenticationEntryPoint apiAuthenticationEntryPoint,
      ApiAccessDeniedHandler apiAccessDeniedHandler
  ) {
    this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    this.apiAuthenticationEntryPoint = apiAuthenticationEntryPoint;
    this.apiAccessDeniedHandler = apiAccessDeniedHandler;
  }

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
        .csrf(AbstractHttpConfigurer::disable)
        .formLogin(AbstractHttpConfigurer::disable)
        .httpBasic(AbstractHttpConfigurer::disable)
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .exceptionHandling(exception -> exception
            .authenticationEntryPoint(apiAuthenticationEntryPoint)
            .accessDeniedHandler(apiAccessDeniedHandler)
        )
        .authorizeHttpRequests(auth -> auth
            // 게스트 입장 토큰 발급 API는 비인증 허용
            .requestMatchers(HttpMethod.POST, "/api/v1/guests/enter").permitAll()
            // 프로젝트 관리 API는 회원/게스트 모두 Bearer 인증 필수
            .requestMatchers("/api/v1/projects/**").authenticated()
            .anyRequest().permitAll()
        )
        .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
  }
}
