package com.ssafer.user.domain.entity;

import com.ssafer.user.domain.enums.AccountStatus;
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
@Table(name = "users")
public class User {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "email", nullable = false, unique = true, length = 255)
  private String email;

  @Column(name = "display_name", nullable = false, length = 100)
  private String displayName;

  @Column(name = "password_hash", length = 255)
  private String passwordHash;

  @Enumerated(EnumType.STRING)
  @Column(name = "account_status", nullable = false, length = 20)
  private AccountStatus accountStatus;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected User() {
  }

  public User(
      String email,
      String displayName,
      String passwordHash,
      AccountStatus accountStatus
  ) {
    this.email = email;
    this.displayName = displayName;
    this.passwordHash = passwordHash;
    this.accountStatus = accountStatus;
  }

  @PrePersist
  void onCreate() {
    // 생성 시각과 수정 시각은 최초 저장 시점에 동일한 값으로 맞춘다.
    Instant now = Instant.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @PreUpdate
  void onUpdate() {
    // 엔티티 변경이 발생하면 수정 시각만 갱신한다.
    this.updatedAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public String getEmail() {
    return email;
  }

  public String getDisplayName() {
    return displayName;
  }

  public void updateDisplayName(String displayName) {
    // 사용자 설정 수정에서는 비밀번호와 분리해서 displayName만 변경한다.
    this.displayName = displayName;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public AccountStatus getAccountStatus() {
    return accountStatus;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
