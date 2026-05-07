package com.ssafer.auth.infrastructure.oauth.github;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.util.List;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
@Slf4j
public class GithubOAuthRestClient implements GithubOAuthApiClient {

  private static final String USER_AGENT = "ssafer-backend/1.0";

  private final RestClient restClient;
  private final GithubOAuthProperties properties;

  public GithubOAuthRestClient(GithubOAuthProperties properties) {
    this.restClient = RestClient.builder()
        .defaultHeader("User-Agent", USER_AGENT)
        .build();
    this.properties = properties;
  }

  @Override
  public GithubOAuthTokenResponse exchangeAuthorizationCode(String authorizationCode, String redirectUri) {
    validateConfigured();

    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("client_id", properties.getClientId());
    form.add("client_secret", properties.getClientSecret());
    form.add("code", authorizationCode);
    form.add("redirect_uri", redirectUri);

    try {
      GithubOAuthTokenResponse response = restClient.post()
          .uri(properties.getTokenUri())
          .contentType(MediaType.APPLICATION_FORM_URLENCODED)
          .accept(MediaType.APPLICATION_JSON)
          .body(form)
          .retrieve()
          .body(GithubOAuthTokenResponse.class);
      return Objects.requireNonNull(response);
    } catch (RestClientResponseException ex) {
      log.error("GitHub OAuth token exchange failed. status={}, response={}", ex.getStatusCode(), ex.getResponseBodyAsString());
      throw translateProviderResponse(ex);
    } catch (BusinessException ex) {
      throw ex;
    } catch (Exception ex) {
      log.error("GitHub OAuth token exchange request failed", ex);
      throw new BusinessException(ErrorCode.OAUTH_PROVIDER_UNAVAILABLE);
    }
  }

  @Override
  public GithubOAuthUserResponse fetchUserInfo(String accessToken) {
    try {
      GithubOAuthUserResponse response = restClient.get()
          .uri(properties.getUserInfoUri())
          .header("Authorization", "Bearer " + accessToken)
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(GithubOAuthUserResponse.class);
      return Objects.requireNonNull(response);
    } catch (RestClientResponseException ex) {
      log.error("GitHub OAuth user info fetch failed. status={}, response={}", ex.getStatusCode(), ex.getResponseBodyAsString());
      throw translateProviderResponse(ex);
    } catch (BusinessException ex) {
      throw ex;
    } catch (Exception ex) {
      log.error("GitHub OAuth user info request failed", ex);
      throw new BusinessException(ErrorCode.OAUTH_PROVIDER_UNAVAILABLE);
    }
  }

  @Override
  public List<GithubOAuthEmailResponse> fetchUserEmails(String accessToken) {
    try {
      List<GithubOAuthEmailResponse> response = restClient.get()
          .uri(properties.getUserEmailsUri())
          .header("Authorization", "Bearer " + accessToken)
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(new ParameterizedTypeReference<List<GithubOAuthEmailResponse>>() {
          });
      return Objects.requireNonNull(response);
    } catch (RestClientResponseException ex) {
      log.error("GitHub OAuth email fetch failed. status={}, response={}", ex.getStatusCode(), ex.getResponseBodyAsString());
      throw translateProviderResponse(ex);
    } catch (BusinessException ex) {
      throw ex;
    } catch (Exception ex) {
      log.error("GitHub OAuth email request failed", ex);
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
