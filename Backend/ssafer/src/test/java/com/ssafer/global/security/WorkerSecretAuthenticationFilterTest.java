package com.ssafer.global.security;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

class WorkerSecretAuthenticationFilterTest {

  @AfterEach
  void tearDown() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void missingWorkerSecretLeavesRequestUnauthenticated() throws Exception {
    WorkerSecretAuthenticationFilter filter = new WorkerSecretAuthenticationFilter("worker-secret");
    MockHttpServletRequest request = new MockHttpServletRequest();
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockFilterChain filterChain = new MockFilterChain();

    filter.doFilter(request, response, filterChain);

    assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    assertThat(filterChain.getRequest()).isSameAs(request);
  }

  @Test
  void invalidWorkerSecretLeavesRequestUnauthenticated() throws Exception {
    WorkerSecretAuthenticationFilter filter = new WorkerSecretAuthenticationFilter("worker-secret");
    MockHttpServletRequest request = new MockHttpServletRequest();
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockFilterChain filterChain = new MockFilterChain();
    request.addHeader(WorkerSecretAuthenticationFilter.WORKER_SECRET_HEADER, "wrong-secret");

    filter.doFilter(request, response, filterChain);

    assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    assertThat(filterChain.getRequest()).isSameAs(request);
  }

  @Test
  void validWorkerSecretAuthenticatesRequest() throws Exception {
    WorkerSecretAuthenticationFilter filter = new WorkerSecretAuthenticationFilter("worker-secret");
    MockHttpServletRequest request = new MockHttpServletRequest();
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockFilterChain filterChain = new MockFilterChain();
    request.addHeader(WorkerSecretAuthenticationFilter.WORKER_SECRET_HEADER, "worker-secret");

    filter.doFilter(request, response, filterChain);

    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    assertThat(authentication).isNotNull();
    assertThat(authentication.getPrincipal()).isEqualTo(WorkerPrincipal.callbackWorker());
    assertThat(authentication.getAuthorities())
        .extracting("authority")
        .containsExactly("ROLE_WORKER");
  }
}
