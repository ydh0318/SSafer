package com.ssafer.agent.infrastructure.messaging;

import com.ssafer.agent.application.service.AgentTaskPublisher;
import com.ssafer.agent.application.service.ScanRequestTaskMessage;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@Slf4j
@RequiredArgsConstructor
public class RabbitAgentTaskPublisher implements AgentTaskPublisher {

  private final RabbitTemplate rabbitTemplate;
  private final AgentTaskQueueProperties properties;
  private final ObjectMapper objectMapper;

  @Override
  public void publishScanRequest(ScanRequestTaskMessage message) {
    try {
      String payloadJson = objectMapper.writeValueAsString(message);
      rabbitTemplate.convertAndSend(properties.getExchange(), properties.getScanRequestRoutingKey(), payloadJson);
    } catch (AmqpException ex) {
      log.error("RabbitMQ publish failed for scan request task: taskId={}", message.taskId(), ex);
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    } catch (Exception ex) {
      log.error("Failed to serialize scan request task message: taskId={}", message.taskId(), ex);
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }
}
