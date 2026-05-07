package com.ssafer;

import com.ssafer.agent.infrastructure.messaging.AgentTaskQueueProperties;
import com.ssafer.agent.ws.AgentHeartbeatProperties;
import com.ssafer.auth.infrastructure.oauth.github.GithubOAuthProperties;
import com.ssafer.auth.infrastructure.oauth.google.GoogleOAuthProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
// heartbeat, RabbitMQ, OAuth 설정 프로퍼티를 바인딩 대상으로 등록한다.
@EnableConfigurationProperties({
    AgentHeartbeatProperties.class,
    AgentTaskQueueProperties.class,
    GoogleOAuthProperties.class,
    GithubOAuthProperties.class
})
public class SsaferApplication {

  public static void main(String[] args) {
    SpringApplication.run(SsaferApplication.class, args);
  }
}
