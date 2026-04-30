package com.ssafer;

import com.ssafer.agent.ws.AgentHeartbeatProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
// heartbeat 관련 설정값 클래스를 프로퍼티 바인딩 대상으로 등록한다.
@EnableConfigurationProperties({AgentHeartbeatProperties.class})
public class SsaferApplication {

  public static void main(String[] args) {
    SpringApplication.run(SsaferApplication.class, args);
  }

}
