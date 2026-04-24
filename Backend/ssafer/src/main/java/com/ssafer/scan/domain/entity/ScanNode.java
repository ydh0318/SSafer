package com.ssafer.scan.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@Builder
@Entity
@Table(name = "scan_nodes")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ScanNode {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "scan_id", nullable = false)
  private Long scanId;

  @Column(name = "node_key", nullable = false, length = 255)
  private String nodeKey;

  @Column(name = "node_name", length = 255)
  private String nodeName;

  @Column(name = "node_type", length = 100)
  private String nodeType;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "metadata_json")
  private String metadataJson;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;
}
