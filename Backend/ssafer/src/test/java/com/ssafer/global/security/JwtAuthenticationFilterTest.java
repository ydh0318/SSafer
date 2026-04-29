package com.ssafer.global.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

class JwtAuthenticationFilterTest {

  @AfterEach
  void tearDown() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void skipsRequestWhenAuthorizationHeaderIsMissing() throws Exception {
    JwtAuthenticationTokenParser tokenParser = Mockito.mock(JwtAuthenticationTokenParser.class);
    JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokenParser);
    MockHttpServletRequest request = new MockHttpServletRequest();
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockFilterChain filterChain = new MockFilterChain();

    filter.doFilter(request, response, filterChain);

    assertThat(filterChain.getRequest()).isSameAs(request);
    assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    verifyNoInteractions(tokenParser);
  }

  @Test
  void authenticatesMemberBearerToken() throws Exception {
    JwtAuthenticationTokenParser tokenParser = Mockito.mock(JwtAuthenticationTokenParser.class);
    JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokenParser);
    MockHttpServletRequest request = new MockHttpServletRequest();
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockFilterChain filterChain = new MockFilterChain();
    request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer member-access-token");
    given(tokenParser.parse("member-access-token")).willReturn(AuthenticatedActor.member(7L));

    filter.doFilter(request, response, filterChain);

    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    assertThat(filterChain.getRequest()).isSameAs(request);
    assertThat(authentication).isNotNull();
    assertThat(authentication.getPrincipal()).isEqualTo(AuthenticatedActor.member(7L));
    assertThat(authentication.getAuthorities())
        .extracting("authority")
        .containsExactly("ROLE_MEMBER");
  }

  @Test
  void authenticatesGuestBearerToken() throws Exception {
    JwtAuthenticationTokenParser tokenParser = Mockito.mock(JwtAuthenticationTokenParser.class);
    JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokenParser);
    MockHttpServletRequest request = new MockHttpServletRequest();
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockFilterChain filterChain = new MockFilterChain();
    request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer guest-access-token");
    given(tokenParser.parse("guest-access-token")).willReturn(AuthenticatedActor.guest("guest-owner"));

    filter.doFilter(request, response, filterChain);

    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    assertThat(authentication).isNotNull();
    assertThat(authentication.getPrincipal()).isEqualTo(AuthenticatedActor.guest("guest-owner"));
    assertThat(authentication.getAuthorities())
        .extracting("authority")
        .containsExactly("ROLE_GUEST");
  }

  @Test
  void blankBearerTokenThrowsBadCredentials() {
    JwtAuthenticationTokenParser tokenParser = Mockito.mock(JwtAuthenticationTokenParser.class);
    JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokenParser);
    MockHttpServletRequest request = new MockHttpServletRequest();
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockFilterChain filterChain = new MockFilterChain();
    request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer   ");

    assertThatThrownBy(() -> filter.doFilter(request, response, filterChain))
        .isInstanceOf(BadCredentialsException.class)
        .hasMessage(ErrorCode.UNAUTHORIZED.message());

    assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    verifyNoInteractions(tokenParser);
  }

  @Test
  void invalidTokenFromParserThrowsBadCredentials() {
    JwtAuthenticationTokenParser tokenParser = Mockito.mock(JwtAuthenticationTokenParser.class);
    JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokenParser);
    MockHttpServletRequest request = new MockHttpServletRequest();
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockFilterChain filterChain = new MockFilterChain();
    request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer invalid-token");
    given(tokenParser.parse("invalid-token")).willThrow(new BusinessException(ErrorCode.UNAUTHORIZED));

    assertThatThrownBy(() -> filter.doFilter(request, response, filterChain))
        .isInstanceOf(BadCredentialsException.class)
        .hasMessage(ErrorCode.UNAUTHORIZED.message());

    assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
  }
}
