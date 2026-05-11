package com.ssafer.scan.application.service;

import com.ssafer.agent.application.service.AgentTaskAvailableRequestedEvent;
import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.agent.ws.AgentTaskAvailableNotificationService;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.api.dto.LocalAgentScanRequest;
import com.ssafer.scan.api.dto.LocalAgentScanRequestResponseData;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanRequestSource;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@Service
// Local Agent 기반 점검 요청을 scan row와 AgentTask row로 나누어 저장하고,
// 저장이 끝난 뒤 WebSocket TASK_AVAILABLE 알림으로 agent에게 새 작업 존재만 알려준다.
public class LocalAgentScanRequestService {

  private final ProjectAuthorizationService projectAuthorizationService;
  private final AgentRepository agentRepository;
  private final ScanRepository scanRepository;
  private final AgentTaskRepository agentTaskRepository;
  private final AgentTaskAvailableNotificationService notificationService;
  private final ObjectMapper objectMapper;
  private final TransactionTemplate transactionTemplate;

  @Value("${APP_SCAN_RAW_S3_BUCKET:ssafer}")
  private String rawResultBucket;

  public LocalAgentScanRequestService(
      ProjectAuthorizationService projectAuthorizationService,
      AgentRepository agentRepository,
      ScanRepository scanRepository,
      AgentTaskRepository agentTaskRepository,
      AgentTaskAvailableNotificationService notificationService,
      ObjectMapper objectMapper,
      PlatformTransactionManager transactionManager
  ) {
    this.projectAuthorizationService = projectAuthorizationService;
    this.agentRepository = agentRepository;
    this.scanRepository = scanRepository;
    this.agentTaskRepository = agentTaskRepository;
    this.notificationService = notificationService;
    this.objectMapper = objectMapper;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  public LocalAgentScanRequestResponseData requestScan(
      Long projectId,
      AuthenticatedActor actor,
      LocalAgentScanRequest request
  ) {
    // DB commit 전에 WebSocket 알림이 먼저 나가면 agent가 task를 조회하지 못할 수 있다.
    // 그래서 scan/task 저장은 별도 트랜잭션으로 먼저 끝내고, 그 다음 알림을 보낸다.
    CreatedAgentScan created = transactionTemplate.execute(status -> createScanAndTask(projectId, actor, request));
    if (created == null) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }

    boolean notificationSent = notificationService.notifyTaskAvailable(created.toNotificationEvent());
    return new LocalAgentScanRequestResponseData(
        created.scanId(),
        created.agentTaskId(),
        created.scanStatus(),
        created.agentTaskStatus(),
        notificationSent
    );
  }

  private CreatedAgentScan createScanAndTask(
      Long projectId,
      AuthenticatedActor actor,
      LocalAgentScanRequest request
  ) {
    Project project = projectAuthorizationService.loadAuthorizedProjectOrThrow(projectId, actor);
    Agent agent = agentRepository.findFirstByProjectId(project.getId())
        .orElseThrow(() -> new BusinessException(ErrorCode.AGENT_NOT_FOUND));
    // 이 API는 실시간 점검 요청이므로 실제 연결된 ONLINE agent가 있을 때만 task를 만든다.
    if (agent.getStatus() != AgentStatus.ONLINE) {
      throw new BusinessException(ErrorCode.AGENT_OFFLINE);
    }

    LocalDateTime now = LocalDateTime.now();
    String normalizedTargetPath = request.targetPath().trim();
    Boolean includeLogs = Boolean.TRUE.equals(request.includeLogs());
    String scanName = normalizeBlank(request.scanName());

    // 사용자가 요청한 점검 이력은 먼저 REQUESTED 상태의 scan으로 남긴다.
    // 실제 실행 시작/완료 상태는 이후 Local Agent의 raw result 업로드와 worker callback 흐름에서 갱신된다.
    Scan scan = scanRepository.save(Scan.builder()
        .projectId(project.getId())
        .requestedByUserId(actor.isMember() ? actor.userId() : null)
        .requestActorType(actor.isMember() ? RequestActorType.USER : RequestActorType.GUEST)
        .agentId(agent.getId())
        .scanMode(ScanMode.AGENT)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.REQUESTED)
        .targetSnapshotJson(buildTargetSnapshotJson(normalizedTargetPath, scanName, includeLogs))
        .requestedAt(now)
        .lastUpdatedAt(now)
        .build());

    String rawResultKey = buildRawResultKey(scan.getId());
    String rawResultPath = buildRawResultPath(rawResultKey);
    // 만료 시간이 있는 rawUploadUrl은 task에 저장하지 않는다.
    // agent가 task를 pull할 때 PendingAgentTaskQueryService가 fresh URL을 발급해 응답에 붙인다.
    scanRepository.updateRawResultPath(scan.getId(), rawResultPath);

    // Local Agent는 pending task 조회 응답의 payload만 보고 실행해야 하므로,
    // 점검 대상 정보와 raw 결과 저장 위치를 같은 payload에 담아 둔다.
    String payloadJson = buildTaskPayloadJson(normalizedTargetPath, scanName, includeLogs, rawResultPath);
    AgentTask task = agentTaskRepository.save(new AgentTask(
        agent,
        project,
        scan,
        null,
        AgentTaskType.SCAN_REQUEST,
        AgentTaskStatus.PENDING,
        payloadJson
    ));

    return new CreatedAgentScan(
        agent.getId(),
        task.getId(),
        task.getTaskType(),
        project.getId(),
        scan.getId(),
        scan.getStatus(),
        task.getTaskStatus()
    );
  }

  private String buildTargetSnapshotJson(String targetPath, String scanName, Boolean includeLogs) {
    // scan 자체에는 요청 당시의 입력값을 snapshot으로 남겨 이후 이력 조회와 디버깅에 사용한다.
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("source", ScanRequestSource.AGENT.name());
    snapshot.put("scanType", ScanType.PROJECT_FILE.name());
    snapshot.put("scanName", scanName);
    snapshot.put("targetPath", targetPath);
    snapshot.put("includeLogs", includeLogs);
    return writeJson(snapshot);
  }

  private String buildTaskPayloadJson(
      String targetPath,
      String scanName,
      Boolean includeLogs,
      String rawResultPath
  ) {
    // CLI agent의 SCAN_REQUEST 처리 로직은 rawUploadUrl로 원본 결과를 올리고,
    // rawUploadUrl은 만료 시간이 있으므로 저장하지 않고 task 조회 시점에 새로 발급한다.
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("targetPath", targetPath);
    payload.put("scanName", scanName);
    payload.put("includeLogs", includeLogs);
    payload.put("rawResultPath", rawResultPath);
    return writeJson(payload);
  }

  private String writeJson(Map<String, Object> value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception ex) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }

  private String buildRawResultKey(Long scanId) {
    return "raw/" + scanId + "/" + UUID.randomUUID() + "/scan_result.json";
  }

  private String buildRawResultPath(String objectKey) {
    return "s3://" + rawResultBucket + "/" + objectKey;
  }

  private String normalizeBlank(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim();
  }

  private record CreatedAgentScan(
      Long agentId,
      Long agentTaskId,
      AgentTaskType agentTaskType,
      Long projectId,
      Long scanId,
      ScanStatus scanStatus,
      AgentTaskStatus agentTaskStatus
  ) {

    AgentTaskAvailableRequestedEvent toNotificationEvent() {
      return new AgentTaskAvailableRequestedEvent(
          agentId,
          agentTaskId,
          agentTaskType,
          projectId,
          scanId,
          null
      );
    }
  }
}
