package com.ssafer.auth.infrastructure.oauth.google;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
@Slf4j
public class GoogleOAuthRestClient implements GoogleOAuthApiClient {

  private static final String USER_AGENT = "ssafer-backend/1.0";

  private final RestClient restClient;
  private final GoogleOAuthProperties properties;

  public GoogleOAuthRestClient(GoogleOAuthProperties properties) {
    this.restClient = RestClient.builder()
        .defaultHeader("User-Agent", USER_AGENT)
        .build();
    this.properties = properties;
  }

  @Override
  public GoogleOAuthTokenResponse exchangeAuthorizationCode(String authorizationCode, String redirectUri) {
    validateConfigured();

    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("grant_type", "authorization_code");
    form.add("code", authorizationCode);
    form.add("client_id", properties.getClientId());
    form.add("client_secret", properties.getClientSecret());
    form.add("redirect_uri", redirectUri);

    try {
      GoogleOAuthTokenResponse response = restClient.post()
          .uri(properties.getTokenUri())
          .contentType(MediaType.APPLICATION_FORM_URLENCODED)
          .body(form)
          .retrieve()
          .body(GoogleOAuthTokenResponse.class);
      return Objects.requireNonNull(response);
    } catch (RestClientResponseException ex) {
      log.error("Google OAuth token exchange failed. status={}, response={}", ex.getStatusCode(), ex.getResponseBodyAsString());
      throw translateProviderResponse(ex);
    } catch (BusinessException ex) {
      throw ex;
    } catch (Exception ex) {
      log.error("Google OAuth token exchange request failed", ex);
      throw new BusinessException(ErrorCode.OAUTH_PROVIDER_UNAVAILABLE);
    }
  }

  @Override
  public GoogleOAuthUserInfoResponse fetchUserInfo(String accessToken) {
    try {
      GoogleOAuthUserInfoResponse response = restClient.get()
          .uri(properties.getUserInfoUri())
          .header("Authorization", "Bearer " + accessToken)
          .retrieve()
          .body(GoogleOAuthUserInfoResponse.class);
      return Objects.requireNonNull(response);
    } catch (RestClientResponseException ex) {
      log.error("Google OAuth user info fetch failed. status={}, response={}", ex.getStatusCode(), ex.getResponseBodyAsString());
      throw translateProviderResponse(ex);
    } catch (BusinessException ex) {
      throw ex;
    } catch (Exception ex) {
      log.error("Google OAuth user info request failed", ex);
      throw new BusinessException(ErrorCode.OAUTH_PROVIDER_UNAVAILABLE);
    }
  }

  private void validateConfigured() {
    if (isBlank(properties.getClientId()) || isBlank(properties.getClientSecret())) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private BusinessException translateProviderResponse(RestClientResponseException ex) {
    if (ex.getStatusCode().is4xxClientError()) {
      return new BusinessException(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
    }
    return new BusinessException(ErrorCode.OAUTH_PROVIDER_UNAVAILABLE);
  }
}
