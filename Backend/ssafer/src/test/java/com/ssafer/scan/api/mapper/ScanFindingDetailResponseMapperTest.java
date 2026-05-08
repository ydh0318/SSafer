package com.ssafer.scan.api.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.ssafer.scan.api.dto.ScanFindingDetailResponse;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.Severity;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class ScanFindingDetailResponseMapperTest {

  @Test
  void toResponseMapsFindingFields() {
    LocalDateTime patchApprovedAt = LocalDateTime.of(2026, 4, 27, 10, 0);
    LocalDateTime patchedAt = patchApprovedAt.plusMinutes(5);
    LocalDateTime createdAt = LocalDateTime.of(2026, 4, 27, 9, 30);

    ScanFinding finding = ScanFinding.builder()
        .id(2001L)
        .scanId(1001L)
        .scanNodeId(3001L)
        .sourceType(FindingSourceType.TRIVY)
        .fingerprint("sha256:abc123")
        .severity(Severity.HIGH)
        .category("CONFIG")
        .title("Image user should not be 'root'")
        .description("Running containers with root user is unsafe.")
        .filePath("Dockerfile")
        .lineNumber(2)
        .resourceName("Dockerfile")
        .ruleCode("DS-0002")
        .attackScenario("Container breakout risk")
        .remediationGuide("Use a non-root USER")
        .rawSnippetJson("{\"line\":2}")
        .patchPayloadJson("{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}")
        .resolutionStatus(ResolutionStatus.OPEN)
        .patchApprovedByUserId(1L)
        .patchApprovedAt(patchApprovedAt)
        .patchResultMessage("Patch prepared")
        .backupFileName("Dockerfile.bak")
        .backupFilePath("/backup/Dockerfile.bak")
        .backupMetadataJson("{\"size\":123}")
        .patchedAt(patchedAt)
        .createdAt(createdAt)
        .build();

    ScanFindingDetailResponse response = ScanFindingDetailResponseMapper.toResponse(finding);

    assertThat(response.findingId()).isEqualTo(2001L);
    assertThat(response.scanId()).isEqualTo(1001L);
    assertThat(response.scanNodeId()).isEqualTo(3001L);
    assertThat(response.sourceType()).isEqualTo(FindingSourceType.TRIVY);
    assertThat(response.fingerprint()).isEqualTo("sha256:abc123");
    assertThat(response.severity()).isEqualTo(Severity.HIGH);
    assertThat(response.category()).isEqualTo("CONFIG");
    assertThat(response.title()).isEqualTo("Image user should not be 'root'");
    assertThat(response.description()).isEqualTo("Running containers with root user is unsafe.");
    assertThat(response.filePath()).isEqualTo("Dockerfile");
    assertThat(response.lineNumber()).isEqualTo(2);
    assertThat(response.resourceName()).isEqualTo("Dockerfile");
    assertThat(response.ruleCode()).isEqualTo("DS-0002");
    assertThat(response.attackScenario()).isEqualTo("Container breakout risk");
    assertThat(response.remediationGuide()).isEqualTo("Use a non-root USER");
    assertThat(response.rawSnippetJson()).isEqualTo("{\"line\":2}");
    assertThat(response.patchPayloadJson()).isEqualTo("{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}");
    assertThat(response.resolutionStatus()).isEqualTo(ResolutionStatus.OPEN);
    assertThat(response.patchApprovedByUserId()).isEqualTo(1L);
    assertThat(response.patchApprovedAt()).isEqualTo(patchApprovedAt);
    assertThat(response.patchResultMessage()).isEqualTo("Patch prepared");
    assertThat(response.backupFileName()).isEqualTo("Dockerfile.bak");
    assertThat(response.backupFilePath()).isEqualTo("/backup/Dockerfile.bak");
    assertThat(response.backupMetadataJson()).isEqualTo("{\"size\":123}");
    assertThat(response.patchedAt()).isEqualTo(patchedAt);
    assertThat(response.createdAt()).isEqualTo(createdAt);
  }
}
