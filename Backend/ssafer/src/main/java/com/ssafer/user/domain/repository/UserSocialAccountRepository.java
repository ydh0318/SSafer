package com.ssafer.user.domain.repository;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.user.domain.entity.UserSocialAccount;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserSocialAccountRepository extends JpaRepository<UserSocialAccount, Long> {

  List<UserSocialAccount> findAllByUserId(Long userId);

  Optional<UserSocialAccount> findByUserIdAndProvider(Long userId, OAuthProvider provider);

  Optional<UserSocialAccount> findByProviderAndProviderUserId(OAuthProvider provider, String providerUserId);

  long countByUserId(Long userId);
}
