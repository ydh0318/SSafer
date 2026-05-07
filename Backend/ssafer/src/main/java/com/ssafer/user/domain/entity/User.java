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

  public String getEmail() {
    return email;
  }

  public String getDisplayName() {
    return displayName;
  }

  public void updateDisplayName(String displayName) {
    this.displayName = displayName;
  }

  public void updatePasswordHash(String passwordHash) {
    this.passwordHash = passwordHash;
  }

  public void deactivate() {
    this.accountStatus = AccountStatus.INACTIVE;
    this.passwordHash = null;
  }

  public void reactivate(String displayName, String passwordHash) {
    this.displayName = displayName;
    this.passwordHash = passwordHash;
    this.accountStatus = AccountStatus.ACTIVE;
  }

  public void reactivateForOAuth(String displayName) {
    this.displayName = displayName;
    this.accountStatus = AccountStatus.ACTIVE;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public boolean hasPasswordCredential() {
    return passwordHash != null && !passwordHash.isBlank();
  }

  public AccountStatus getAccountStatus() {
    return accountStatus;
  }

  public boolean isActive() {
    return accountStatus == AccountStatus.ACTIVE;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
