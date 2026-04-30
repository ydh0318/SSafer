package com.ssafer.agent.application.service;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AgentTokenRegistry;
import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgentTokenIssueService {

  private final AgentRepository agentRepository;
  private final AgentTokenRegistry agentTokenRegistry;
  private final SecureRandom secureRandom = new SecureRandom();

  public AgentTokenIssueService(
      AgentRepository agentRepository,
      AgentTokenRegistry agentTokenRegistry
  ) {
    this.agentRepository = agentRepository;
    this.agentTokenRegistry = agentTokenRegistry;
  }

  @Transactional
  public String issueToken(Long agentId) {
    // Agent 재발급 시 기존 해시를 새 해시로 덮어써 즉시 회전되도록 한다.
    Agent agent = agentRepository.findById(agentId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    String rawToken = generateToken();
    String hash = agentTokenRegistry.hashToken(rawToken);
    agent.updateAuthTokenHash(hash);
    return rawToken;
  }

  private String generateToken() {
    // 256-bit 랜덤 값을 URL-safe 문자열로 인코딩해 전송용 원문 토큰으로 사용한다.
    byte[] bytes = new byte[32];
    secureRandom.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
