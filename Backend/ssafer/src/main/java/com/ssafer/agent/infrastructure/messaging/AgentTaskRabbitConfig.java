package com.ssafer.agent.infrastructure.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AgentTaskRabbitConfig {

  @Bean
  public DirectExchange agentTaskExchange(AgentTaskQueueProperties properties) {
    return new DirectExchange(properties.getExchange(), true, false);
  }

  @Bean
  public Queue agentScanRequestQueue(AgentTaskQueueProperties properties) {
    return new Queue(properties.getScanRequestQueue(), true);
  }

  @Bean
  public Binding agentScanRequestBinding(
      DirectExchange agentTaskExchange,
      Queue agentScanRequestQueue,
      AgentTaskQueueProperties properties
  ) {
    return BindingBuilder.bind(agentScanRequestQueue)
        .to(agentTaskExchange)
        .with(properties.getScanRequestRoutingKey());
  }
}
