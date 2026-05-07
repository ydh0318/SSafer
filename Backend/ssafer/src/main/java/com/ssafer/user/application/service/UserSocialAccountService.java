package com.ssafer.user.application.service;

import com.ssafer.auth.application.service.OAuthLoginProviderHandler;
import com.ssafer.auth.application.service.OAuthProviderUserInfo;
import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.entity.UserSocialAccount;
import com.ssafer.user.domain.enums.AccountStatus;
import com.ssafer.user.domain.repository.UserRepository;
import com.ssafer.user.domain.repository.UserSocialAccountRepository;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserSocialAccountService {

  private static final List<OAuthProvider> SUPPORTED_PROVIDERS = List.of(
      OAuthProvider.GOOGLE,
      OAuthProvider.GITHUB
  );

  private final Map<OAuthProvider, OAuthLoginProviderHandler> handlers;
  private final UserRepository userRepository;
  private final UserSocialAccountRepository userSocialAccountRepository;

  public UserSocialAccountService(
      List<OAuthLoginProviderHandler> handlers,
      UserRepository userRepository,
      UserSocialAccountRepository userSocialAccountRepository
  ) {
    this.handlers = new EnumMap<>(OAuthProvider.class);
    for (OAuthLoginProviderHandler handler : handlers) {
      this.handlers.put(handler.provider(), handler);
    }
    this.userRepository = userRepository;
    this.userSocialAccountRepository = userSocialAccountRepository;
  }

  @Transactional(readOnly = true)
  public List<UserSocialAccountResult> getCurrentUserSocialAccounts(AuthenticatedActor actor) {
    User user = loadCurrentMemberOrThrow(actor);
    Map<OAuthProvider, UserSocialAccount> linkedAccounts = new EnumMap<>(OAuthProvider.class);
    for (UserSocialAccount account : userSocialAccountRepository.findAllByUserId(user.getId())) {
      linkedAccounts.put(account.getProvider(), account);
    }

    return SUPPORTED_PROVIDERS.stream()
        .map(provider -> toResult(provider, linkedAccounts.get(provider)))
        .toList();
  }

  @Transactional
  public UserSocialAccountResult connectCurrentUserSocialAccount(
      AuthenticatedActor actor,
      OAuthProvider provider,
      String authorizationCode,
      String redirectUri
  ) {
    User user = loadCurrentMemberOrThrow(actor);
    if (userSocialAccountRepository.findByUserIdAndProvider(user.getId(), provider).isPresent()) {
      throw new BusinessException(ErrorCode.SOCIAL_ACCOUNT_ALREADY_LINKED);
    }

    // 제공자에서 확인한 소셜 사용자 정보를 현재 로그인한 회원 계정에 연결한다.
    OAuthProviderUserInfo userInfo = fetchUserInfo(provider, authorizationCode, redirectUri);
    UserSocialAccount linkedAccount = createSocialAccountLink(user, userInfo);
    return toResult(provider, linkedAccount);
  }

  @Transactional
  public void disconnectCurrentUserSocialAccount(AuthenticatedActor actor, OAuthProvider provider) {
    User user = loadCurrentMemberOrThrow(actor);
    UserSocialAccount linkedAccount = userSocialAccountRepository.findByUserIdAndProvider(user.getId(), provider)
        .orElseThrow(() -> new BusinessException(ErrorCode.SOCIAL_ACCOUNT_NOT_LINKED));

    // 비밀번호 또는 다른 소셜 계정 중 하나는 남아 있어야 하므로 마지막 로그인 수단 해제는 막는다.
    if (!user.hasPasswordCredential() && userSocialAccountRepository.countByUserId(user.getId()) <= 1) {
      throw new BusinessException(ErrorCode.SOCIAL_ACCOUNT_DISCONNECT_NOT_ALLOWED);
    }

    userSocialAccountRepository.delete(linkedAccount);
  }

  @Transactional(readOnly = true)
  public Optional<User> findLinkedUser(OAuthProvider provider, String providerUserId) {
    return userSocialAccountRepository.findByProviderAndProviderUserId(provider, providerUserId)
        .flatMap(account -> userRepository.findById(account.getUserId()));
  }

  @Transactional
  public void syncSocialLogin(User user, OAuthProviderUserInfo userInfo) {
    UserSocialAccount existingByProvider = userSocialAccountRepository
        .findByUserIdAndProvider(user.getId(), userInfo.provider())
        .orElse(null);

    if (existingByProvider != null) {
      // 같은 provider에 다른 providerUserId가 들어오면 다른 사용자 소유 계정으로 본다.
      if (!existingByProvider.getProviderUserId().equals(userInfo.providerUserId())) {
        throw new BusinessException(ErrorCode.SOCIAL_ACCOUNT_ALREADY_LINKED);
      }
      existingByProvider.updateSocialEmail(userInfo.email());
      return;
    }

    createSocialAccountLink(user, userInfo);
  }

  private UserSocialAccount createSocialAccountLink(User user, OAuthProviderUserInfo userInfo) {
    Optional<UserSocialAccount> existingByExternalAccount = userSocialAccountRepository.findByProviderAndProviderUserId(
        userInfo.provider(),
        userInfo.providerUserId()
    );
    if (existingByExternalAccount.isPresent()) {
      UserSocialAccount linkedAccount = existingByExternalAccount.get();
      if (!linkedAccount.getUserId().equals(user.getId())) {
        throw new BusinessException(ErrorCode.SOCIAL_ACCOUNT_ALREADY_LINKED);
      }
      linkedAccount.updateSocialEmail(userInfo.email());
      return linkedAccount;
    }

    try {
      return userSocialAccountRepository.saveAndFlush(new UserSocialAccount(
          user.getId(),
          userInfo.provider(),
          userInfo.providerUserId(),
          userInfo.email()
      ));
    } catch (DataIntegrityViolationException ex) {
      throw UserSocialAccountConstraintViolationSupport.translateLinkException(ex);
    }
  }

  private OAuthProviderUserInfo fetchUserInfo(OAuthProvider provider, String authorizationCode, String redirectUri) {
    OAuthLoginProviderHandler handler = handlers.get(provider);
    if (handler == null) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
    return handler.fetchUserInfo(authorizationCode, redirectUri);
  }

  private User loadCurrentMemberOrThrow(AuthenticatedActor actor) {
    if (actor == null || !actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    return userRepository.findByIdAndAccountStatus(actor.userId(), AccountStatus.ACTIVE)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  private UserSocialAccountResult toResult(OAuthProvider provider, UserSocialAccount account) {
    if (account == null) {
      return new UserSocialAccountResult(provider, false, null, null);
    }
    return new UserSocialAccountResult(
        provider,
        true,
        account.getSocialEmail(),
        account.getCreatedAt()
    );
  }
}
