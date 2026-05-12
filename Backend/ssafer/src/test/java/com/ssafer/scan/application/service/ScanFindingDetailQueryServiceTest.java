package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanFindingDetailResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ScanFindingDetailQueryServiceTest {

  @Mock
  private ScanRepository scanRepository;

  @Mock
  private ScanFindingRepository scanFindingRepository;

  @Mock
  private CurrentActorProvider currentActorProvider;

  @Mock
  private ProjectAuthorizationService projectAuthorizationService;

  @InjectMocks
  private ScanFindingDetailQueryService scanFindingDetailQueryService;

  @Test
  void getScanFindingDetailReturnsResponse() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 4, 27, 9, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 27, 9, 5))
        .build();
    ScanFinding finding = ScanFinding.builder()
        .id(2001L)
        .scanId(1001L)
        .scanNodeId(3001L)
        .sourceType(FindingSourceType.TRIVY)
        .fingerprint("sha256:abc123")
        .severity(Severity.HIGH)
        .category("CONFIG")
        .title("Image user should not be 'root'")
        .description("Running containers with root is risky")
        .filePath("Dockerfile")
        .lineNumber(2)
        .resourceName("Dockerfile")
        .ruleCode("DS-0002")
        .attackScenario("Container escape")
        .remediationGuide("Use non-root user")
        .rawSnippetJson("""
            {
              "maskedEvidence": "USER root",
              "impact": "초보자도 이해하기 쉬운 영향",
              "targetFiles": ["Dockerfile"],
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
                "recommendedActions": ["조치 1"],
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
        .patchApprovedActorType(com.ssafer.scan.domain.enums.RequestActorType.USER)
        .patchApprovedByUserId(1L)
        .patchApprovedAt(LocalDateTime.of(2026, 4, 27, 10, 0))
        .patchResultMessage("Patch prepared")
        .backupFileName("Dockerfile.bak")
        .backupFilePath("/backup/Dockerfile.bak")
        .backupMetadataJson("{\"size\":128}")
        .patchedAt(LocalDateTime.of(2026, 4, 27, 10, 5))
        .createdAt(LocalDateTime.of(2026, 4, 27, 9, 30))
        .build();

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    when(scanFindingRepository.findByIdAndScanId(2001L, 1001L)).thenReturn(Optional.of(finding));

    ScanFindingDetailResponse response =
        scanFindingDetailQueryService.getScanFindingDetail(1001L, 2001L);

    assertThat(response.findingId()).isEqualTo(2001L);
    assertThat(response.scanId()).isEqualTo(1001L);
    assertThat(response.scanNodeId()).isEqualTo(3001L);
    assertThat(response.sourceType()).isEqualTo(FindingSourceType.TRIVY);
    assertThat(response.severity()).isEqualTo(Severity.HIGH);
    assertThat(response.category()).isEqualTo("CONFIG");
    assertThat(response.lineNumber()).isEqualTo(2);
    assertThat(response.ruleCode()).isEqualTo("DS-0002");
    assertThat(response.maskedEvidence()).isEqualTo("USER root");
    assertThat(response.explanation()).isNotNull();
    assertThat(response.explanation().whyRisky()).isEqualTo("위험한 이유");
    assertThat(response.impact()).isEqualTo("초보자도 이해하기 쉬운 영향");
    assertThat(response.fix()).isNotNull();
    assertThat(response.fix().patches()).hasSize(1);
    assertThat(response.targetFiles()).containsExactly("Dockerfile");
    assertThat(response.patchApprovedActorType()).isEqualTo(RequestActorType.USER);
    verify(projectAuthorizationService).loadAuthorizedProjectOrThrow(101L, actor);
  }

  @Test
  void getScanFindingDetailWhenScanMissingThrowsNotFound() {
    when(currentActorProvider.getCurrentActor()).thenReturn(AuthenticatedActor.member(1L));
    when(scanRepository.findById(999L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> scanFindingDetailQueryService.getScanFindingDetail(999L, 2001L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void getScanFindingDetailWhenFindingMissingThrowsNotFound() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 4, 27, 9, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 27, 9, 5))
        .build();

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    when(scanFindingRepository.findByIdAndScanId(9999L, 1001L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> scanFindingDetailQueryService.getScanFindingDetail(1001L, 9999L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  @Test
  void getScanFindingDetailWhenProjectForbiddenThrowsForbidden() {
    AuthenticatedActor actor = AuthenticatedActor.member(1L);
    Scan scan = Scan.builder()
        .id(1001L)
        .projectId(101L)
        .requestedByUserId(1L)
        .requestActorType(RequestActorType.USER)
        .scanMode(ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .requestedAt(LocalDateTime.of(2026, 4, 27, 9, 0))
        .lastUpdatedAt(LocalDateTime.of(2026, 4, 27, 9, 5))
        .build();

    when(currentActorProvider.getCurrentActor()).thenReturn(actor);
    when(scanRepository.findById(1001L)).thenReturn(Optional.of(scan));
    doThrow(new BusinessException(ErrorCode.FORBIDDEN))
        .when(projectAuthorizationService)
        .loadAuthorizedProjectOrThrow(101L, actor);

    assertThatThrownBy(() -> scanFindingDetailQueryService.getScanFindingDetail(1001L, 2001L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FORBIDDEN);
  }
}
