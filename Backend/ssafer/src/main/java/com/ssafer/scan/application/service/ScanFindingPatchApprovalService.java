package com.ssafer.scan.application.service;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.agent.domain.repository.AgentTaskRepository;
import com.ssafer.agent.application.service.AgentTaskAvailableRequestedEvent;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.time.LocalDateTime;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
// 승인 가능한 finding만 PATCH_APPLY task로 전환하고 승인 이력을 함께 남긴다.
public class ScanFindingPatchApprovalService {

  private final ScanRepository scanRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final AgentRepository agentRepository;
  private final AgentTaskRepository agentTaskRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;
  private final ApplicationEventPublisher applicationEventPublisher;

  public ScanFindingPatchApprovalService(
      ScanRepository scanRepository,
      ScanFindingRepository scanFindingRepository,
      AgentRepository agentRepository,
      AgentTaskRepository agentTaskRepository,
      CurrentActorProvider currentActorProvider,
      ProjectAuthorizationService projectAuthorizationService,
      ApplicationEventPublisher applicationEventPublisher
  ) {
    this.scanRepository = scanRepository;
    this.scanFindingRepository = scanFindingRepository;
    this.agentRepository = agentRepository;
    this.agentTaskRepository = agentTaskRepository;
    this.currentActorProvider = currentActorProvider;
    this.projectAuthorizationService = projectAuthorizationService;
    this.applicationEventPublisher = applicationEventPublisher;
  }

  @Transactional
  public ScanFindingPatchApprovalResult approve(Long scanId, Long findingId) {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan scan = scanRepository.findByIdAndDeletedAtIsNull(scanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    Project project = projectAuthorizationService.loadAuthorizedProjectForUpdateOrThrow(scan.getProjectId(), actor);
    ScanFinding finding = scanFindingRepository.findByIdAndScanIdForUpdate(findingId, scanId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    validatePatchApproval(scan, finding);

    LocalDateTime approvedAt = LocalDateTime.now();
    finding.approvePatch(actor, approvedAt);

    Agent agent = loadOrCreateProjectAgent(project);
    AgentTask task = agentTaskRepository.save(new AgentTask(
        agent,
        project,
        scan,
        finding,
        AgentTaskType.PATCH_APPLY,
        AgentTaskStatus.PENDING,
        finding.getPatchPayloadJson()
    ));
    applicationEventPublisher.publishEvent(new AgentTaskAvailableRequestedEvent(
        agent.getId(),
        task.getId(),
        task.getTaskType(),
        project.getId(),
        scan.getId(),
        finding.getId()
    ));

    return new ScanFindingPatchApprovalResult(
        scan.getId(),
        finding.getId(),
        task.getId(),
        agent.getId(),
        finding.getResolutionStatus(),
        finding.getPatchApprovedActorType(),
        finding.getPatchApprovedByUserId(),
        finding.getPatchApprovedAt(),
        task.getQueuedAt()
    );
  }

  private void validatePatchApproval(Scan scan, ScanFinding finding) {
    if (scan.getStatus() != ScanStatus.DONE) {
      throw new BusinessException(ErrorCode.SCAN_STATUS_CONFLICT);
    }
    if (finding.getPatchPayloadJson() == null || finding.getPatchPayloadJson().isBlank()) {
      throw new BusinessException(ErrorCode.PATCH_PAYLOAD_NOT_FOUND);
    }
    if (finding.getResolutionStatus() != ResolutionStatus.OPEN) {
      throw new BusinessException(ErrorCode.PATCH_APPROVAL_NOT_ALLOWED);
    }
  }

  private Agent loadOrCreateProjectAgent(Project project) {
    return agentRepository.findFirstByProjectId(project.getId())
        .orElseGet(() -> agentRepository.save(new Agent(project, AgentStatus.OFFLINE, true)));
  }
}
