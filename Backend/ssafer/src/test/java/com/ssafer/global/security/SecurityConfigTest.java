package com.ssafer.global.security;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import tools.jackson.databind.ObjectMapper;

class SecurityConfigTest {

  private static final String WORKER_SECRET = "worker-secret-2026";

  private AnnotationConfigWebApplicationContext context;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    context = new AnnotationConfigWebApplicationContext();
    context.setServletContext(new MockServletContext());
    context.register(TestConfig.class, SecurityConfig.class);
    context.refresh();

    mockMvc = MockMvcBuilders.webAppContextSetup(context)
        .apply(springSecurity())
        .build();
  }

  @AfterEach
  void tearDown() {
    if (context != null) {
      context.close();
    }
  }

  @Test
  void publicEndpointsAreAccessibleWithoutAuthentication() throws Exception {
    mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isOk());

    mockMvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isOk());

    mockMvc.perform(post("/api/v1/auth/email/send-code").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isOk());

    mockMvc.perform(post("/api/v1/auth/email/verify-code").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isOk());

    mockMvc.perform(post("/api/v1/users").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isOk());

    mockMvc.perform(get("/api/v1/users/check-email"))
        .andExpect(status().isOk());

    mockMvc.perform(post("/api/v1/guests/enter").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isOk());
  }

  @Test
  void memberApisRequireJwtAuthenticationByDefault() throws Exception {
    mockMvc.perform(get("/api/v1/projects"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
        .andExpect(jsonPath("$.message").value("Authentication is required or token is invalid"))
        .andExpect(jsonPath("$.data").isMap());

    mockMvc.perform(get("/api/v1/scans/1"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

    mockMvc.perform(get("/api/v1/admin/probe"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  @Test
  void memberApisAcceptAuthenticatedRequest() throws Exception {
    UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
        AuthenticatedActor.member(1L),
        null,
        List.of(new SimpleGrantedAuthority("ROLE_MEMBER"))
    );

    mockMvc.perform(get("/api/v1/projects").with(authentication(authenticationToken)))
        .andExpect(status().isOk());

    mockMvc.perform(get("/api/v1/scans/1").with(authentication(authenticationToken)))
        .andExpect(status().isOk());
  }

  @Test
  void internalApisRequireWorkerSecretHeader() throws Exception {
    mockMvc.perform(post("/api/v1/internal/scans/1/raw-results")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  @Test
  void internalApisAcceptValidWorkerSecretHeader() throws Exception {
    mockMvc.perform(post("/api/v1/internal/scans/1/raw-results")
            .header(WorkerSecretAuthenticationFilter.WORKER_SECRET_HEADER, WORKER_SECRET)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isOk());
  }

  @Test
  void authenticatedMemberWithoutRequiredRoleGetsForbiddenResponse() throws Exception {
    UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
        AuthenticatedActor.member(1L),
        null,
        List.of(new SimpleGrantedAuthority("ROLE_MEMBER"))
    );

    mockMvc.perform(get("/api/v1/admin/role-probe").with(authentication(authenticationToken)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"))
        .andExpect(jsonPath("$.message").value("You do not have permission to access this resource"))
        .andExpect(jsonPath("$.data").isMap());
  }

  @Configuration
  @EnableWebMvc
  @EnableWebSecurity
  @EnableMethodSecurity
  static class TestConfig {

    @Bean
    JwtAuthenticationFilter jwtAuthenticationFilter() {
      return new JwtAuthenticationFilter(Mockito.mock(JwtAuthenticationTokenParser.class));
    }

    @Bean
    WorkerSecretAuthenticationFilter workerSecretAuthenticationFilter() {
      return new WorkerSecretAuthenticationFilter(WORKER_SECRET);
    }

    @Bean
    ApiAuthenticationEntryPoint apiAuthenticationEntryPoint() {
      return new ApiAuthenticationEntryPoint(new ObjectMapper());
    }

    @Bean
    ApiAccessDeniedHandler apiAccessDeniedHandler() {
      return new ApiAccessDeniedHandler(new ObjectMapper());
    }

    @Bean
    TestEndpoints testEndpoints() {
      return new TestEndpoints();
    }
  }

  @RestController
  @RequestMapping
  static class TestEndpoints {

    @PostMapping("/api/v1/auth/login")
    String login() {
      return "ok";
    }

    @PostMapping("/api/v1/auth/refresh")
    String refresh() {
      return "ok";
    }

    @PostMapping("/api/v1/auth/email/send-code")
    String sendCode() {
      return "ok";
    }

    @PostMapping("/api/v1/auth/email/verify-code")
    String verifyCode() {
      return "ok";
    }

    @PostMapping("/api/v1/users")
    String register() {
      return "ok";
    }

    @GetMapping("/api/v1/users/check-email")
    String checkEmail() {
      return "ok";
    }

    @PostMapping("/api/v1/guests/enter")
    String guestEnter() {
      return "ok";
    }

    @GetMapping("/api/v1/projects")
    String projects() {
      return "ok";
    }

    @GetMapping("/api/v1/scans/1")
    String scan() {
      return "ok";
    }

    @PostMapping("/api/v1/internal/scans/1/raw-results")
    String rawResults() {
      return "ok";
    }

    @GetMapping("/api/v1/admin/probe")
    String adminProbe() {
      return "ok";
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/api/v1/admin/role-probe")
    String adminRoleProbe() {
      return "ok";
    }
  }
}
