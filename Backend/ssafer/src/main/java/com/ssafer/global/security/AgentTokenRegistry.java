package com.ssafer.global.security;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.repository.AgentRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AgentTokenRegistry {

  private final AgentRepository agentRepository;

  public AgentTokenRegistry(AgentRepository agentRepository) {
    this.agentRepository = agentRepository;
  }

  @Transactional(readOnly = true)
  public Long findMatchedAgentId(String token) {
    // Bearer 토큰 해시로 Agent를 역조회해 인증 주체(agentId)를 식별한다.
    return agentRepository.findByAuthTokenHash(hashToken(token))
        .map(Agent::getId)
        .orElse(null);
  }

  @Transactional(readOnly = true)
  public boolean isAuthorizedForAgent(Long agentId, String token) {
    // 특정 agentId 요청에 대해 해당 토큰이 그 Agent 소유 토큰인지 검증한다.
    if (agentId == null) {
      return false;
    }
    return agentRepository.findById(agentId)
        .map(agent -> {
          String authTokenHash = agent.getAuthTokenHash();
          return authTokenHash != null && authTokenHash.equals(hashToken(token));
        })
        .orElse(false);
  }

  public String hashToken(String token) {
    // 원문 토큰은 저장하지 않고 SHA-256 해시만 저장/비교한다.
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
      return toHex(hash);
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 algorithm is required", ex);
    }
  }

  private String toHex(byte[] bytes) {
    StringBuilder builder = new StringBuilder(bytes.length * 2);
    for (byte b : bytes) {
      builder.append(Character.forDigit((b >> 4) & 0xF, 16));
      builder.append(Character.forDigit(b & 0xF, 16));
    }
    return builder.toString();
  }
}
