package com.ssafer.agent.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AgentTokenRegistry;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

class AgentTokenIssueServiceTest {

  private AgentRepository agentRepository;
  private AgentTokenRegistry agentTokenRegistry;
  private AgentTokenIssueService service;

  @BeforeEach
  void setUp() {
    agentRepository = Mockito.mock(AgentRepository.class);
    agentTokenRegistry = Mockito.mock(AgentTokenRegistry.class);
    service = new AgentTokenIssueService(agentRepository, agentTokenRegistry);
  }

  @Test
  void issueTokenStoresHashedTokenOnAgent() {
    Agent agent = buildAgent();
    given(agentRepository.findById(1L)).willReturn(Optional.of(agent));
    given(agentTokenRegistry.hashToken(Mockito.anyString())).willReturn("hashed-value");

    String rawToken = service.issueToken(1L);

    assertThat(rawToken).isNotBlank();
    assertThat(agent.getAuthTokenHash()).isEqualTo("hashed-value");
  }

  @Test
  void issueTokenThrowsNotFoundWhenAgentMissing() {
    given(agentRepository.findById(1L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.issueToken(1L))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.NOT_FOUND);
  }

  private Agent buildAgent() {
    Project project = new Project(1L, null, "project", null, ScanMode.AGENT, false);
    ReflectionTestUtils.setField(project, "id", 10L);
    Agent agent = new Agent(project, AgentStatus.OFFLINE);
    ReflectionTestUtils.setField(agent, "id", 1L);
    return agent;
  }
}

