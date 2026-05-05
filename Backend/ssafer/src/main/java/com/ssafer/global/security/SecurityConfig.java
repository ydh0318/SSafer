package com.ssafer.global.security;

import com.ssafer.global.logging.ApiRequestLoggingFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

  private final JwtAuthenticationFilter jwtAuthenticationFilter;
  private final AgentTokenAuthenticationFilter agentTokenAuthenticationFilter;
  private final WorkerSecretAuthenticationFilter workerSecretAuthenticationFilter;
  private final ApiRequestLoggingFilter apiRequestLoggingFilter;
  private final ApiAuthenticationEntryPoint apiAuthenticationEntryPoint;
  private final ApiAccessDeniedHandler apiAccessDeniedHandler;

  public SecurityConfig(
      JwtAuthenticationFilter jwtAuthenticationFilter,
      AgentTokenAuthenticationFilter agentTokenAuthenticationFilter,
      WorkerSecretAuthenticationFilter workerSecretAuthenticationFilter,
      ApiRequestLoggingFilter apiRequestLoggingFilter,
      ApiAuthenticationEntryPoint apiAuthenticationEntryPoint,
      ApiAccessDeniedHandler apiAccessDeniedHandler
  ) {
    this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    this.agentTokenAuthenticationFilter = agentTokenAuthenticationFilter;
    this.workerSecretAuthenticationFilter = workerSecretAuthenticationFilter;
    this.apiRequestLoggingFilter = apiRequestLoggingFilter;
    this.apiAuthenticationEntryPoint = apiAuthenticationEntryPoint;
    this.apiAccessDeniedHandler = apiAccessDeniedHandler;
  }

  @Bean
  @Order(1)
  public SecurityFilterChain internalAgentSecurityFilterChain(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/api/v1/internal/agents/**")
        .csrf(AbstractHttpConfigurer::disable)
        .formLogin(AbstractHttpConfigurer::disable)
        .httpBasic(AbstractHttpConfigurer::disable)
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .exceptionHandling(exception -> exception
            .authenticationEntryPoint(apiAuthenticationEntryPoint)
            .accessDeniedHandler(apiAccessDeniedHandler)
        )
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
        .addFilterBefore(apiRequestLoggingFilter, UsernamePasswordAuthenticationFilter.class)
        .addFilterBefore(agentTokenAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
  }

  @Bean
  @Order(2)
  public SecurityFilterChain internalSecurityFilterChain(HttpSecurity http) throws Exception {
    return http
        // 워커 콜백 API는 사용자 JWT와 분리된 내부 인증 체인을 사용한다.
        .securityMatcher("/api/v1/internal/**")
        .csrf(AbstractHttpConfigurer::disable)
        .formLogin(AbstractHttpConfigurer::disable)
        .httpBasic(AbstractHttpConfigurer::disable)
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .exceptionHandling(exception -> exception
            .authenticationEntryPoint(apiAuthenticationEntryPoint)
            .accessDeniedHandler(apiAccessDeniedHandler)
        )
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
        .addFilterBefore(apiRequestLoggingFilter, UsernamePasswordAuthenticationFilter.class)
        .addFilterBefore(workerSecretAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
  }

  @Bean
  @Order(3)
  public SecurityFilterChain apiSecurityFilterChain(HttpSecurity http) throws Exception {
    return http
        // 일반 API는 기존 회원/게스트 JWT 인증 흐름을 그대로 사용한다.
        .csrf(AbstractHttpConfigurer::disable)
        .formLogin(AbstractHttpConfigurer::disable)
        .httpBasic(AbstractHttpConfigurer::disable)
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .exceptionHandling(exception -> exception
            .authenticationEntryPoint(apiAuthenticationEntryPoint)
            .accessDeniedHandler(apiAccessDeniedHandler)
        )
        .authorizeHttpRequests(auth -> auth
            .requestMatchers(
                "/v3/api-docs/**",
                "/swagger-ui/**",
                "/swagger-ui.html",
                "/actuator/health"
            ).permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/refresh").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/email/send-code").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/email/verify-code").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/password-reset/send-code").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/password-reset/verify-code").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/password-reset/complete").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/users").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/users/check-email").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/guests/enter").permitAll()
            // 공개 API를 제외한 /api 경로는 기본적으로 JWT 인증이 필요하다.
            .requestMatchers("/api/**").authenticated()
            .anyRequest().permitAll()
        )
        .addFilterBefore(apiRequestLoggingFilter, UsernamePasswordAuthenticationFilter.class)
        .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  public FilterRegistrationBean<JwtAuthenticationFilter> jwtAuthenticationFilterRegistration(
      JwtAuthenticationFilter jwtAuthenticationFilter
  ) {
    FilterRegistrationBean<JwtAuthenticationFilter> registration = new FilterRegistrationBean<>(jwtAuthenticationFilter);
    // JWT 필터는 SecurityFilterChain 내부에서만 동작해야 하므로 서블릿 필터 자동 등록은 끈다.
    registration.setEnabled(false);
    return registration;
  }

  @Bean
  public FilterRegistrationBean<WorkerSecretAuthenticationFilter> workerSecretAuthenticationFilterRegistration(
      WorkerSecretAuthenticationFilter workerSecretAuthenticationFilter
  ) {
    FilterRegistrationBean<WorkerSecretAuthenticationFilter> registration =
        new FilterRegistrationBean<>(workerSecretAuthenticationFilter);
    // 워커 시크릿 필터도 내부 API 보안 체인에서만 실행되도록 자동 등록을 끈다.
    registration.setEnabled(false);
    return registration;
  }

  @Bean
  public FilterRegistrationBean<AgentTokenAuthenticationFilter> agentTokenAuthenticationFilterRegistration(
      AgentTokenAuthenticationFilter agentTokenAuthenticationFilter
  ) {
    FilterRegistrationBean<AgentTokenAuthenticationFilter> registration =
        new FilterRegistrationBean<>(agentTokenAuthenticationFilter);
    registration.setEnabled(false);
    return registration;
  }

  @Bean
  public FilterRegistrationBean<ApiRequestLoggingFilter> apiRequestLoggingFilterRegistration(
      ApiRequestLoggingFilter apiRequestLoggingFilter
  ) {
    FilterRegistrationBean<ApiRequestLoggingFilter> registration =
        new FilterRegistrationBean<>(apiRequestLoggingFilter);
    registration.setEnabled(false);
    return registration;
  }
}
