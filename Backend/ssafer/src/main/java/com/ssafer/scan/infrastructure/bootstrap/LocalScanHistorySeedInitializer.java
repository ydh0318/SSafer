package com.ssafer.scan.infrastructure.bootstrap;

import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.entity.ScanNode;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanNodeRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("local")
@Order(2)
public class LocalScanHistorySeedInitializer implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(LocalScanHistorySeedInitializer.class);

  private static final String TEST_USER_EMAIL = "test@ssafer.co.kr";
  private static final String HISTORY_PROJECT_NAME = "로컬 히스토리 테스트 프로젝트";

  private final UserRepository userRepository;
  private final ProjectRepository projectRepository;
  private final ScanRepository scanRepository;
  private final ScanNodeRepository scanNodeRepository;
  private final ScanFindingRepository scanFindingRepository;

  public LocalScanHistorySeedInitializer(
      UserRepository userRepository,
      ProjectRepository projectRepository,
      ScanRepository scanRepository,
      ScanNodeRepository scanNodeRepository,
      ScanFindingRepository scanFindingRepository
  ) {
    this.userRepository = userRepository;
    this.projectRepository = projectRepository;
    this.scanRepository = scanRepository;
    this.scanNodeRepository = scanNodeRepository;
    this.scanFindingRepository = scanFindingRepository;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    // 이 시드는 테스트 회원이 먼저 만들어진 뒤에만 의미가 있다.
    // 그래서 실행 순서를 회원 시드 뒤로 고정하고, 회원이 없으면 조용히 종료한다.
    User user = userRepository.findByEmail(TEST_USER_EMAIL)
        .orElse(null);

    if (user == null) {
      log.info("Skip local scan history seed because local test user was not found. email={}", TEST_USER_EMAIL);
      return;
    }

    // 이미 히스토리용 스캔이 존재하면 중복으로 만들지 않는다.
    if (!scanRepository.findByRequestedByUserIdOrderByRequestedAtDescIdDesc(user.getId()).isEmpty()) {
      log.info("Local scan history already exists. userEmail={}", TEST_USER_EMAIL);
      return;
    }

    Project project = loadOrCreateLocalHistoryProject(user.getId());

    // Swagger나 로컬 수동 테스트에서 목록, 요약, 위험도 분포가 바로 보이도록
    // 완료 스캔과 진행 중 스캔을 섞어서 예시 데이터를 만든다.
    seedDoneAgentScan(project.getId(), user.getId());
    seedDoneUploadScan(project.getId(), user.getId());
    seedRunningScan(project.getId(), user.getId());

    log.info("Local scan history seed created. userEmail={}, projectName={}", TEST_USER_EMAIL, HISTORY_PROJECT_NAME);
  }

  private Project loadOrCreateLocalHistoryProject(Long userId) {
    return projectRepository.findByUserIdAndDeletedAtIsNull(userId).stream()
        .filter(project -> HISTORY_PROJECT_NAME.equals(project.getName()))
        .findFirst()
        .orElseGet(() -> projectRepository.save(new Project(
            userId,
            null,
            HISTORY_PROJECT_NAME,
            "로컬 히스토리 조회와 스웨거 확인용 테스트 프로젝트",
            com.ssafer.project.domain.enums.ScanMode.AGENT,
            false
        )));
  }

  private void seedDoneAgentScan(Long projectId, Long userId) {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 29, 9, 0);
    LocalDateTime startedAt = requestedAt.plusMinutes(1);
    LocalDateTime completedAt = requestedAt.plusMinutes(7);

    Scan scan = scanRepository.save(Scan.builder()
        .projectId(projectId)
        .requestedByUserId(userId)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(ScanStatus.DONE)
        .progressStep("SUMMARY_SAVED")
        .requestedAt(requestedAt)
        .startedAt(startedAt)
        .completedAt(completedAt)
        .lastUpdatedAt(completedAt)
        .build());

    ScanNode node = scanNodeRepository.save(ScanNode.builder()
        .scanId(scan.getId())
        .nodeKey("agent-node-1")
        .nodeName("backend-service")
        .nodeType("CONTAINER_IMAGE")
        .metadataJson("{\"image\":\"ssafer/backend:1.0.0\"}")
        .createdAt(startedAt)
        .build());

    scanFindingRepository.saveAll(List.of(
        createFinding(scan.getId(), node.getId(), Severity.CRITICAL, "SECRET", "운영 토큰 노출", "/app/.env", 12,
            "ENV_SECRET_EXPOSED"),
        createFinding(scan.getId(), node.getId(), Severity.HIGH, "CONFIG", "과도한 권한 설정", "/app/security.yml", 33,
            "IAM_ADMIN_PRIVILEGE"),
        createFinding(scan.getId(), node.getId(), Severity.MEDIUM, "DEPENDENCY", "취약한 의존성 버전", "/app/pom.xml", 18,
            "CVE-2026-0001"),
        createFinding(scan.getId(), node.getId(), Severity.LOW, "BEST_PRACTICE", "디버그 설정 활성화", "/app/application-local.properties", 4,
            "DEBUG_ENABLED")
    ));
  }

  private void seedDoneUploadScan(Long projectId, Long userId) {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 28, 14, 30);
    LocalDateTime startedAt = requestedAt.plusMinutes(2);
    LocalDateTime completedAt = requestedAt.plusMinutes(11);

    Scan scan = scanRepository.save(Scan.builder()
        .projectId(projectId)
        .requestedByUserId(userId)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.UPLOAD)
        .status(ScanStatus.DONE)
        .progressStep("SUMMARY_SAVED")
        .requestedAt(requestedAt)
        .startedAt(startedAt)
        .completedAt(completedAt)
        .lastUpdatedAt(completedAt)
        .build());

    ScanNode node = scanNodeRepository.save(ScanNode.builder()
        .scanId(scan.getId())
        .nodeKey("upload-node-1")
        .nodeName("uploaded-repository")
        .nodeType("SOURCE_ARCHIVE")
        .metadataJson("{\"archiveName\":\"sample-project.zip\"}")
        .createdAt(startedAt)
        .build());

    scanFindingRepository.saveAll(List.of(
        createFinding(scan.getId(), node.getId(), Severity.HIGH, "CONFIG", "공개 저장소 인증키 하드코딩", "/src/main/resources/application.properties", 11,
            "HARDCODED_CREDENTIAL"),
        createFinding(scan.getId(), node.getId(), Severity.HIGH, "SECRET", "AWS 액세스 키 노출", "/src/main/resources/application.properties", 15,
            "AWS_ACCESS_KEY"),
        createFinding(scan.getId(), node.getId(), Severity.MEDIUM, "DEPENDENCY", "업데이트가 필요한 라이브러리", "/build.gradle", 29,
            "CVE-2026-0002"),
        createFinding(scan.getId(), node.getId(), Severity.MEDIUM, "CONFIG", "CORS 허용 범위 과다", "/src/main/java/com/ssafer/config/WebConfig.java", 22,
            "WIDE_OPEN_CORS"),
        createFinding(scan.getId(), node.getId(), Severity.LOW, "BEST_PRACTICE", "보안 헤더 누락", "/src/main/java/com/ssafer/config/SecurityConfig.java", 41,
            "MISSING_SECURITY_HEADERS"),
        createFinding(scan.getId(), node.getId(), Severity.INFO, "NOTICE", "스캔 대상 파일 수가 많음", null, null,
            "LARGE_SCAN_SCOPE")
    ));
  }

  private void seedRunningScan(Long projectId, Long userId) {
    LocalDateTime requestedAt = LocalDateTime.of(2026, 4, 30, 10, 0);
    LocalDateTime startedAt = requestedAt.plusMinutes(1);

    scanRepository.save(Scan.builder()
        .projectId(projectId)
        .requestedByUserId(userId)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(ScanStatus.RUNNING)
        .progressStep("COLLECTING_RESULTS")
        .requestedAt(requestedAt)
        .startedAt(startedAt)
        .completedAt(null)
        .lastUpdatedAt(startedAt.plusMinutes(3))
        .build());
  }

  private ScanFinding createFinding(
      Long scanId,
      Long scanNodeId,
      Severity severity,
      String category,
      String title,
      String filePath,
      Integer lineNumber,
      String ruleCode
  ) {
    return ScanFinding.builder()
        .scanId(scanId)
        .scanNodeId(scanNodeId)
        .sourceType(FindingSourceType.TRIVY)
        .fingerprint(scanId + "-" + severity + "-" + ruleCode + "-" + category)
        .severity(severity)
        .category(category)
        .title(title)
        .description("로컬 히스토리 조회와 스웨거 확인용 시드 파인딩입니다.")
        .filePath(filePath)
        .lineNumber(lineNumber)
        .resourceName("local-seed-resource")
        .ruleCode(ruleCode)
        .attackScenario("로컬 테스트용 시나리오")
        .remediationGuide("로컬 테스트용 가이드")
        .rawSnippetJson(null)
        .resolutionStatus(ResolutionStatus.OPEN)
        .createdAt(LocalDateTime.of(2026, 4, 30, 10, 0))
        .build();
  }
}
