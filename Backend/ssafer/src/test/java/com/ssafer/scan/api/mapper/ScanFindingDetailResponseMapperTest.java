package com.ssafer.scan.api.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.ssafer.scan.api.dto.ScanFindingDetailResponse;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.Severity;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class ScanFindingDetailResponseMapperTest {

  @Test
  void toResponseMapsStructuredWorkerFields() {
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
        .description("취약점 요약")
        .filePath("Dockerfile")
        .lineNumber(2)
        .resourceName("Dockerfile")
        .ruleCode("DS-0002")
        .attackScenario("악용 가능 시나리오")
        .remediationGuide("Use a non-root USER")
        .rawSnippetJson("""
            {
              "maskedEvidence": "USER root",
              "impact": "초보자도 이해하기 쉬운 영향",
              "references": [
                {
                  "title": "CVE-2024-21626 - NVD",
                  "url": "https://nvd.nist.gov/vuln/detail/CVE-2024-21626",
                  "snippet": "A container escape vulnerability"
                },
                {
                  "title": "Broken reference"
                }
              ],
              "targetFiles": ["Dockerfile", "docker-compose.yml"],
              "explanation": {
                "summary": "취약점 요약",
                "whyRisky": "위험한 이유",
                "abuseScenario": "악용 가능 시나리오",
                "expectedImpact": "예상 영향",
                "severityInterpretation": "심각도 해석"
              },
              "fix": {
                "summary": "수정 요약",
                "priority": "high",
                "recommendedActions": ["조치 1", "조치 2"],
                "codeGuidance": "코드 가이드",
                "verification": "검증 방법",
                "cautions": ["주의사항"],
                "patches": [
                  {
                    "patchId": "PATCH-0001",
                    "findingId": "FND-0001",
                    "operation": "replace",
                    "filePath": "Dockerfile",
                    "oldText": "USER root",
                    "newText": "USER app",
                    "expectedFileHash": "sha256:abc"
                  }
                ]
              }
            }
            """)
        .patchPayloadJson("{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}")
        .resolutionStatus(ResolutionStatus.OPEN)
        .patchApprovedActorType(RequestActorType.USER)
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
    assertThat(response.description()).isEqualTo("취약점 요약");
    assertThat(response.maskedEvidence()).isEqualTo("USER root");
    assertThat(response.explanation()).isNotNull();
    assertThat(response.explanation().summary()).isEqualTo("취약점 요약");
    assertThat(response.explanation().whyRisky()).isEqualTo("위험한 이유");
    assertThat(response.explanation().abuseScenario()).isEqualTo("악용 가능 시나리오");
    assertThat(response.explanation().expectedImpact()).isEqualTo("예상 영향");
    assertThat(response.explanation().severityInterpretation()).isEqualTo("심각도 해석");
    assertThat(response.impact()).isEqualTo("초보자도 이해하기 쉬운 영향");
    assertThat(response.filePath()).isEqualTo("Dockerfile");
    assertThat(response.lineNumber()).isEqualTo(2);
    assertThat(response.resourceName()).isEqualTo("Dockerfile");
    assertThat(response.ruleCode()).isEqualTo("DS-0002");
    assertThat(response.attackScenario()).isEqualTo("악용 가능 시나리오");
    assertThat(response.remediationGuide()).isEqualTo("Use a non-root USER");
    assertThat(response.fix()).isNotNull();
    assertThat(response.fix().summary()).isEqualTo("수정 요약");
    assertThat(response.fix().priority()).isEqualTo("high");
    assertThat(response.fix().recommendedActions()).containsExactly("조치 1", "조치 2");
    assertThat(response.fix().codeGuidance()).isEqualTo("코드 가이드");
    assertThat(response.fix().verification()).isEqualTo("검증 방법");
    assertThat(response.fix().cautions()).containsExactly("주의사항");
    assertThat(response.fix().patches()).hasSize(1);
    assertThat(response.fix().patches().getFirst().patchId()).isEqualTo("PATCH-0001");
    assertThat(response.references()).hasSize(1);
    assertThat(response.references().getFirst().title()).isEqualTo("CVE-2024-21626 - NVD");
    assertThat(response.references().getFirst().url()).isEqualTo("https://nvd.nist.gov/vuln/detail/CVE-2024-21626");
    assertThat(response.targetFiles()).containsExactly("Dockerfile", "docker-compose.yml");
    assertThat(response.rawSnippetJson()).contains("\"maskedEvidence\"");
    assertThat(response.rawSnippetJson()).contains("USER root");
    assertThat(response.patchPayloadJson()).isEqualTo("{\"patches\":[{\"patchId\":\"PATCH-0001\"}]}");
    assertThat(response.resolutionStatus()).isEqualTo(ResolutionStatus.OPEN);
    assertThat(response.patchApprovedActorType()).isEqualTo(RequestActorType.USER);
    assertThat(response.patchApprovedByUserId()).isEqualTo(1L);
    assertThat(response.patchApprovedAt()).isEqualTo(patchApprovedAt);
    assertThat(response.patchResultMessage()).isEqualTo("Patch prepared");
    assertThat(response.backupFileName()).isEqualTo("Dockerfile.bak");
    assertThat(response.backupFilePath()).isEqualTo("/backup/Dockerfile.bak");
    assertThat(response.backupMetadataJson()).isEqualTo("{\"size\":123}");
    assertThat(response.patchedAt()).isEqualTo(patchedAt);
    assertThat(response.createdAt()).isEqualTo(createdAt);
  }

  @Test
  void toResponseFallsBackToPersistedColumnsWhenRawSnippetIsMissing() {
    ScanFinding finding = ScanFinding.builder()
        .id(2001L)
        .scanId(1001L)
        .scanNodeId(3001L)
        .sourceType(FindingSourceType.CUSTOM_RULE)
        .fingerprint("sha256:abc123")
        .severity(Severity.HIGH)
        .category("CUSTOM_RULE")
        .title("서비스에 민감한 환경변수가 설정됨")
        .description("취약점 요약")
        .attackScenario("악용 가능 시나리오")
        .build();

    ScanFindingDetailResponse response = ScanFindingDetailResponseMapper.toResponse(finding);

    assertThat(response.explanation()).isNotNull();
    assertThat(response.explanation().summary()).isEqualTo("취약점 요약");
    assertThat(response.explanation().abuseScenario()).isEqualTo("악용 가능 시나리오");
    assertThat(response.fix()).isNull();
    assertThat(response.references()).isEmpty();
    assertThat(response.targetFiles()).isEmpty();
  }
}
