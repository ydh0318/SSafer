package com.ssafer.agent.ws;

import static org.assertj.core.api.Assertions.assertThat;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import com.ssafer.project.domain.repository.ProjectRepository;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AgentWebSocketIntegrationTest {

  private static final String TEST_AGENT_TOKEN = "test-agent-token";

  @LocalServerPort
  private int port;

  @Autowired
  private AgentRepository agentRepository;

  @Autowired
  private ProjectRepository projectRepository;

  @Autowired
  private ObjectMapper objectMapper;

  @Autowired
  private com.ssafer.global.security.AgentTokenRegistry agentTokenRegistry;

  @AfterEach
  void cleanup() {
    agentRepository.deleteAll();
    projectRepository.deleteAll();
  }

  @Test
  void connectMessageMarksAgentOnlineAndReturnsConnected() throws Exception {
    Agent agent = persistAgent();
    TestSocketHandler handler = new TestSocketHandler();
    WebSocketSession session = connect(handler);

    session.sendMessage(new TextMessage("""
        {"type":"CONNECT","agentId":%d,"projectId":%d}
        """.formatted(agent.getId(), agent.getProject().getId())));

    String payload = handler.awaitMessage();
    JsonNode response = objectMapper.readTree(payload);
    assertThat(response.get("type").asText()).isEqualTo("CONNECTED");
    assertThat(response.get("data").get("agentId").asLong()).isEqualTo(agent.getId());
    assertThat(response.get("data").get("status").asText()).isEqualTo("ONLINE");

    Agent updated = loadAgent(agent.getId());
    assertThat(updated.getStatus()).isEqualTo(AgentStatus.ONLINE);
    assertThat(updated.getConnectedAt()).isNotNull();
    assertThat(updated.getLastSeenAt()).isNotNull();
    assertThat(updated.getDisconnectedAt()).isNull();
  }

  @Test
  void pingMessageUpdatesLastSeenAndReturnsPong() throws Exception {
    Agent agent = persistAgent();
    TestSocketHandler handler = new TestSocketHandler();
    WebSocketSession session = connect(handler);

    session.sendMessage(new TextMessage("""
        {"type":"CONNECT","agentId":%d,"projectId":%d}
        """.formatted(agent.getId(), agent.getProject().getId())));
    handler.awaitMessage();

    Instant beforePing = loadAgent(agent.getId()).getLastSeenAt();
    Thread.sleep(20L);

    session.sendMessage(new TextMessage("""
        {"type":"PING","agentId":%d,"timestamp":"2026-04-23T09:05:00Z"}
        """.formatted(agent.getId())));

    String payload = handler.awaitMessage();
    JsonNode response = objectMapper.readTree(payload);
    assertThat(response.get("type").asText()).isEqualTo("PONG");
    assertThat(response.get("serverTime").asText()).isNotBlank();

    Agent updated = loadAgent(agent.getId());
    assertThat(updated.getLastSeenAt()).isAfter(beforePing);
  }

  @Test
  void reconnectWithSameAgentIdClosesOldSessionAndKeepsOnlineStatus() throws Exception {
    Agent agent = persistAgent();

    TestSocketHandler firstHandler = new TestSocketHandler();
    WebSocketSession firstSession = connect(firstHandler);
    firstSession.sendMessage(new TextMessage("""
        {"type":"CONNECT","agentId":%d,"projectId":%d}
        """.formatted(agent.getId(), agent.getProject().getId())));
    firstHandler.awaitMessage();

    TestSocketHandler secondHandler = new TestSocketHandler();
    WebSocketSession secondSession = connect(secondHandler);
    secondSession.sendMessage(new TextMessage("""
        {"type":"CONNECT","agentId":%d,"projectId":%d}
        """.formatted(agent.getId(), agent.getProject().getId())));
    secondHandler.awaitMessage();

    assertThat(firstHandler.awaitClosed()).isTrue();

    awaitTrue(() -> loadAgent(agent.getId()).getStatus() == AgentStatus.ONLINE, Duration.ofSeconds(2));
    Agent updated = loadAgent(agent.getId());
    assertThat(updated.getStatus()).isEqualTo(AgentStatus.ONLINE);
    assertThat(updated.getDisconnectedAt()).isNull();
  }

  private WebSocketSession connect(TestSocketHandler handler) throws Exception {
    WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
    headers.add(HttpHeaders.AUTHORIZATION, "Bearer " + TEST_AGENT_TOKEN);
    URI uri = URI.create("ws://localhost:" + port + "/ws/v1/internal/agents/connect");
    return new StandardWebSocketClient().execute(handler, headers, uri).get(3, TimeUnit.SECONDS);
  }

  private Agent persistAgent() {
    Project project = new Project(1L, null, "ws-agent-project", null, ScanMode.AGENT, false);
    Project savedProject = projectRepository.save(project);
    Agent agent = new Agent(savedProject, AgentStatus.OFFLINE);
    agent.updateAuthTokenHash(agentTokenRegistry.hashToken(TEST_AGENT_TOKEN));
    return agentRepository.save(agent);
  }

  private Agent loadAgent(Long agentId) {
    return agentRepository.findById(agentId).orElseThrow();
  }

  private void awaitTrue(BooleanSupplier condition, Duration timeout) throws InterruptedException {
    long deadline = System.currentTimeMillis() + timeout.toMillis();
    while (System.currentTimeMillis() < deadline) {
      if (condition.getAsBoolean()) {
        return;
      }
      Thread.sleep(25L);
    }
    assertThat(condition.getAsBoolean()).isTrue();
  }

  private static class TestSocketHandler extends TextWebSocketHandler {

    private final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
    private final CountDownLatch closeLatch = new CountDownLatch(1);

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
      messages.add(message.getPayload());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
      closeLatch.countDown();
    }

    String awaitMessage() throws InterruptedException {
      String payload = messages.poll(3, TimeUnit.SECONDS);
      assertThat(payload).isNotNull();
      return payload;
    }

    boolean awaitClosed() throws InterruptedException {
      return closeLatch.await(3, TimeUnit.SECONDS);
    }
  }
}
