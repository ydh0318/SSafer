package com.ssafer.agent.domain.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import com.ssafer.agent.domain.enums.AgentTaskType;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.entity.ScanNode;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import jakarta.persistence.EntityManager;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.util.ReflectionTestUtils;

@SpringBootTest
@Transactional
class AgentRepositoryTest {

  @Autowired
  private AgentRepository agentRepository;

  @Autowired
  private AgentTaskRepository agentTaskRepository;

  @Autowired
  private EntityManager entityManager;

  @Test
  void findByProjectIdReturnsAgentsInProject() {
    Project project = new Project(10L, null, "project-a", null, ScanMode.AGENT, false);
    entityManager.persist(project);
    Project anotherProject = new Project(20L, null, "project-b", null, ScanMode.AGENT, false);
    entityManager.persist(anotherProject);
    entityManager.flush();

    Agent agent1 = agentRepository.save(new Agent(project, AgentStatus.ONLINE));
    agentRepository.save(new Agent(anotherProject, AgentStatus.ERROR));
    entityManager.flush();

    List<Agent> found = agentRepository.findByProjectId(project.getId());

    assertThat(found).extracting(Agent::getId).containsExactly(agent1.getId());
  }

  @Test
  void findByAgentIdAndTaskStatusInOrderByQueuedAtAscReturnsUnprocessedTasksInOrder() {
    Project project = new Project(30L, null, "project-c", null, ScanMode.AGENT, false);
    entityManager.persist(project);
    Agent agent = new Agent(project, AgentStatus.ONLINE);
    entityManager.persist(agent);
    entityManager.flush();

    Scan scan = Scan.builder()
        .projectId(project.getId())
        .requestedByUserId(30L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.AGENT)
        .status(ScanStatus.REQUESTED)
        .requestedAt(LocalDateTime.now().minusMinutes(10))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(10))
        .build();
    entityManager.persist(scan);
    entityManager.flush();

    ScanNode scanNode = ScanNode.builder()
        .scanId(scan.getId())
        .nodeKey("node-1")
        .createdAt(LocalDateTime.now().minusMinutes(9))
        .build();
    entityManager.persist(scanNode);
    entityManager.flush();

    ScanFinding finding = ScanFinding.builder()
        .scanId(scan.getId())
        .scanNodeId(scanNode.getId())
        .sourceType(FindingSourceType.TRIVY)
        .fingerprint("fp-1")
        .severity(Severity.MEDIUM)
        .category("security")
        .title("sample finding")
        .resolutionStatus(ResolutionStatus.OPEN)
        .createdAt(LocalDateTime.now().minusMinutes(8))
        .build();
    entityManager.persist(finding);
    entityManager.flush();

    AgentTask first = agentTaskRepository.save(new AgentTask(
        agent,
        project,
        scan,
        null,
        AgentTaskType.SCAN_REQUEST,
        AgentTaskStatus.PENDING,
        "{\"scanMode\":\"AGENT\"}"
    ));
    AgentTask second = agentTaskRepository.save(new AgentTask(
        agent,
        project,
        scan,
        finding,
        AgentTaskType.PATCH_APPLY,
        AgentTaskStatus.RUNNING,
        "{\"action\":\"PATCH_APPLY\"}"
    ));
    agentTaskRepository.save(new AgentTask(
        agent,
        project,
        scan,
        finding,
        AgentTaskType.PATCH_APPLY,
        AgentTaskStatus.SUCCEEDED,
        "{\"action\":\"PATCH_APPLY\"}"
    ));

    ReflectionTestUtils.setField(first, "queuedAt", java.time.Instant.parse("2026-04-28T00:00:01Z"));
    ReflectionTestUtils.setField(second, "queuedAt", java.time.Instant.parse("2026-04-28T00:00:02Z"));
    entityManager.flush();
    entityManager.clear();

    List<AgentTask> found = agentTaskRepository.findByAgentIdAndTaskStatusInOrderByQueuedAtAsc(
        agent.getId(),
        List.of(
            AgentTaskStatus.PENDING,
            AgentTaskStatus.SENT,
            AgentTaskStatus.ACKED,
            AgentTaskStatus.RUNNING
        )
    );

    assertThat(found).hasSize(2);
    assertThat(found.get(0).getTaskStatus()).isEqualTo(AgentTaskStatus.PENDING);
    assertThat(found.get(1).getTaskStatus()).isEqualTo(AgentTaskStatus.RUNNING);
    assertThat(found).extracting(AgentTask::getId).containsExactly(first.getId(), second.getId());
  }
}
