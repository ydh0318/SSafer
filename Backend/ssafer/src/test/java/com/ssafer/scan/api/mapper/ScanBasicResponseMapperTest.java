package com.ssafer.scan.api.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.ssafer.scan.api.dto.ScanBasicResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class ScanBasicResponseMapperTest {

  @Test
  void toResponseMapsScanFields() {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 23, 9, 0);
    LocalDateTime startedAt = requestedAt.plusMinutes(1);
    LocalDateTime completedAt = requestedAt.plusMinutes(3);
    LocalDateTime lastUpdatedAt = completedAt;

    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .progressStep("completed")
        .failureReason(null)
        .rawResultPath("s3://ssafer/raw/1001/scan_result.json")
        .requestedAt(requestedAt)
        .startedAt(startedAt)
        .completedAt(completedAt)
        .lastUpdatedAt(lastUpdatedAt)
        .build();

    ScanBasicResponse response = ScanBasicResponseMapper.toResponse(scan);

    assertThat(response.scanId()).isEqualTo(1001L);
    assertThat(response.projectId()).isEqualTo(101L);
    assertThat(response.scanMode()).isEqualTo(ScanMode.AGENT);
    assertThat(response.status()).isEqualTo(ScanStatus.DONE);
    assertThat(response.progressStep()).isEqualTo("completed");
    assertThat(response.failureReason()).isNull();
    assertThat(response.rawResultPath()).isEqualTo("s3://ssafer/raw/1001/scan_result.json");
    assertThat(response.requestedAt()).isEqualTo(requestedAt);
    assertThat(response.startedAt()).isEqualTo(startedAt);
    assertThat(response.completedAt()).isEqualTo(completedAt);
    assertThat(response.lastUpdatedAt()).isEqualTo(lastUpdatedAt);
  }
}
