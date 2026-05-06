package com.ssafer.agent.domain.entity;

import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.project.domain.entity.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "agents")
public class Agent {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "project_id", nullable = false)
  private Project project;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 20)
  private AgentStatus status = AgentStatus.OFFLINE;

  @Column(name = "last_seen_at")
  private Instant lastSeenAt;

  @Column(name = "last_error_message", columnDefinition = "text")
  private String lastErrorMessage;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "connected_at")
  private Instant connectedAt;

  @Column(name = "disconnected_at")
  private Instant disconnectedAt;

  @Column(name = "auth_token_hash", length = 64)
  private String authTokenHash;

  @Column(name = "is_placeholder", nullable = false)
  // 실제 Agent가 붙기 전에 임시로 만든 대리 Agent 여부.
  private boolean placeholder;

  protected Agent() {
  }

  public Agent(Project project, AgentStatus status) {
    this(project, status, false);
  }

  public Agent(Project project, AgentStatus status, boolean placeholder) {
    // placeholder=true면 "프로젝트에 Agent가 없어서 임시로 만든 행"을 뜻한다.
    this.project = project;
    this.status = status;
    this.placeholder = placeholder;
  }

  @PrePersist
  void onCreate() {
    if (createdAt == null) {
      createdAt = Instant.now();
    }
  }

  public Long getId() {
    return id;
  }

  public Project getProject() {
    return project;
  }

  public AgentStatus getStatus() {
    return status;
  }

  public Instant getLastSeenAt() {
    return lastSeenAt;
  }

  public String getLastErrorMessage() {
    return lastErrorMessage;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getConnectedAt() {
    return connectedAt;
  }

  public Instant getDisconnectedAt() {
    return disconnectedAt;
  }

  public String getAuthTokenHash() {
    return authTokenHash;
  }

  public boolean isPlaceholder() {
    return placeholder;
  }

  public void markOnline(Instant now) {
    status = AgentStatus.ONLINE;
    connectedAt = now;
    lastSeenAt = now;
    disconnectedAt = null;
    // 실제 연결이 성립하면 placeholder 표시는 즉시 해제한다.
    placeholder = false;
  }

  public void markOffline(Instant now) {
    status = AgentStatus.OFFLINE;
    disconnectedAt = now;
  }

  public void touchLastSeen(Instant now) {
    lastSeenAt = now;
  }

  public void updateAuthTokenHash(String authTokenHash) {
    this.authTokenHash = authTokenHash;
  }
}
