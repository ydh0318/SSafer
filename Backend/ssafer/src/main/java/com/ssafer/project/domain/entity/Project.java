package com.ssafer.project.domain.entity;

import com.ssafer.project.domain.enums.ScanMode;
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
@Table(name = "projects")
public class Project {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id")
  private Long userId;

  @Column(name = "guest_owner_key_hash", length = 255)
  private String guestOwnerKeyHash;

  @Column(name = "name", nullable = false, length = 255)
  private String name;

  @Column(name = "description", columnDefinition = "TEXT")
  private String description;

  @Enumerated(EnumType.STRING)
  @Column(name = "default_scan_mode", nullable = false, length = 20)
  private ScanMode defaultScanMode = ScanMode.AGENT;

  @Column(name = "default_rule_set_id")
  private Long defaultRuleSetId;

  @Column(name = "monitor_enabled", nullable = false)
  private boolean monitorEnabled = false;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  protected Project() {
  }

  public Project(
      Long userId,
      String guestOwnerKeyHash,
      String name,
      String description,
      ScanMode defaultScanMode,
      boolean monitorEnabled
  ) {
    this.userId = userId;
    this.guestOwnerKeyHash = guestOwnerKeyHash;
    this.name = name;
    this.description = description;
    this.defaultScanMode = defaultScanMode;
    this.monitorEnabled = monitorEnabled;
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

  public String getGuestOwnerKeyHash() {
    return guestOwnerKeyHash;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public ScanMode getDefaultScanMode() {
    return defaultScanMode;
  }

  public boolean isMonitorEnabled() {
    return monitorEnabled;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public Instant getDeletedAt() {
    return deletedAt;
  }
}
