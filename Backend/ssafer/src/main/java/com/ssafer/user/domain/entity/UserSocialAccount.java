package com.ssafer.user.domain.entity;

import com.ssafer.auth.domain.enums.OAuthProvider;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "user_social_accounts")
public class UserSocialAccount {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Enumerated(EnumType.STRING)
  @Column(name = "provider", nullable = false, length = 20)
  private OAuthProvider provider;

  @Column(name = "provider_user_id", nullable = false, length = 255)
  private String providerUserId;

  @Column(name = "social_email", nullable = false, length = 255)
  private String socialEmail;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected UserSocialAccount() {
  }

  public UserSocialAccount(Long userId, OAuthProvider provider, String providerUserId, String socialEmail) {
    this.userId = userId;
    this.provider = provider;
    this.providerUserId = providerUserId;
    this.socialEmail = socialEmail;
  }

  @PrePersist
  void onCreate() {
    Instant now = Instant.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @PreUpdate
  void onUpdate() {
    this.updatedAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public Long getUserId() {
    return userId;
  }

  public OAuthProvider getProvider() {
    return provider;
  }

  public String getProviderUserId() {
    return providerUserId;
  }

  public String getSocialEmail() {
    return socialEmail;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void updateSocialEmail(String socialEmail) {
    this.socialEmail = socialEmail;
  }
}
