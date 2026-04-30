package com.ssafer.global.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

class AgentTokenRegistryTest {

  private AgentRepository agentRepository;
  private AgentTokenRegistry registry;

  @BeforeEach
  void setUp() {
    agentRepository = Mockito.mock(AgentRepository.class);
    registry = new AgentTokenRegistry(agentRepository);
  }

  @Test
  void findMatchedAgentIdReturnsAgentIdWhenHashMatches() {
    Agent agent = buildAgent(1L);
    String hash = registry.hashToken("token-a");
    agent.updateAuthTokenHash(hash);
    given(agentRepository.findByAuthTokenHash(hash)).willReturn(Optional.of(agent));

    Long matched = registry.findMatchedAgentId("token-a");

    assertThat(matched).isEqualTo(1L);
  }

  @Test
  void isAuthorizedForAgentReturnsFalseWhenAgentMismatch() {
    Agent agent = buildAgent(1L);
    agent.updateAuthTokenHash(registry.hashToken("token-a"));
    given(agentRepository.findById(1L)).willReturn(Optional.of(agent));

    assertThat(registry.isAuthorizedForAgent(1L, "token-b")).isFalse();
  }

  private Agent buildAgent(Long agentId) {
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 10L);
    Agent agent = new Agent(project, AgentStatus.OFFLINE);
    ReflectionTestUtils.setField(agent, "id", agentId);
    return agent;
  }
}

