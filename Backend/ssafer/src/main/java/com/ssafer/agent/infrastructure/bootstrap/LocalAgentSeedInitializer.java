package com.ssafer.agent.infrastructure.bootstrap;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.repository.ProjectRepository;
import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.repository.UserRepository;
import java.time.Instant;
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
@Order(3)
public class LocalAgentSeedInitializer implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(LocalAgentSeedInitializer.class);
  private static final String TEST_USER_EMAIL = "test@ssafer.co.kr";

  private final UserRepository userRepository;
  private final ProjectRepository projectRepository;
  private final AgentRepository agentRepository;

  public LocalAgentSeedInitializer(
      UserRepository userRepository,
      ProjectRepository projectRepository,
      AgentRepository agentRepository
  ) {
    this.userRepository = userRepository;
    this.projectRepository = projectRepository;
    this.agentRepository = agentRepository;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    // 로컬 테스트 사용자 프로젝트마다 agent 1개를 보장해서
    // CLI 완료 알림 -> RabbitMQ 발행 흐름을 바로 확인할 수 있게 한다.
    User user = userRepository.findByEmail(TEST_USER_EMAIL)
        .orElse(null);

    if (user == null) {
      log.info("Skip local agent seed because local test user was not found. email={}", TEST_USER_EMAIL);
      return;
    }

    List<Project> projects = projectRepository.findByUserIdAndDeletedAtIsNull(user.getId());
    if (projects.isEmpty()) {
      log.info("Skip local agent seed because local test user has no projects. email={}", TEST_USER_EMAIL);
      return;
    }

    int seededCount = 0;
    Instant now = Instant.now();
    for (Project project : projects) {
      if (!agentRepository.findByProjectId(project.getId()).isEmpty()) {
        continue;
      }

      Agent agent = new Agent(project, AgentStatus.ONLINE);
      agent.markOnline(now);
      agentRepository.save(agent);
      seededCount++;
    }

    if (seededCount == 0) {
      log.info("Local agents already exist for every test project. email={}", TEST_USER_EMAIL);
      return;
    }

    log.info("Local agent seed created. email={}, seededProjectCount={}", TEST_USER_EMAIL, seededCount);
  }
}
