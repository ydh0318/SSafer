package com.ssafer.agent.application.service;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import com.ssafer.agent.domain.repository.AgentRepository;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgentConnectionService {

  private final AgentRepository agentRepository;

  public AgentConnectionService(AgentRepository agentRepository) {
    this.agentRepository = agentRepository;
  }

  @Transactional(readOnly = true)
  public Agent loadAgentForConnect(Long agentId, Long projectId) {
    // CONNECT 시점에는 사전 등록된 agent + project 소속 일치 여부만 허용한다.
    return agentRepository.findByIdAndProjectId(agentId, projectId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  @Transactional
  public void markOnline(Long agentId, Instant now) {
    Agent agent = agentRepository.findById(agentId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    agent.markOnline(now);
  }

  @Transactional
  public void touchLastSeen(Long agentId, Instant now) {
    Agent agent = agentRepository.findById(agentId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    agent.touchLastSeen(now);
  }

  @Transactional
  public void markOffline(Long agentId, Instant now) {
    Agent agent = agentRepository.findById(agentId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    agent.markOffline(now);
  }

  @Transactional
  public int markTimedOutAgentsOffline(Instant cutoff, Instant now) {
    // heartbeat timeout 기준보다 오래 응답이 없는 ONLINE agent를 OFFLINE으로 전환한다.
    List<Agent> agents = agentRepository.findByStatusAndLastSeenAtBefore(AgentStatus.ONLINE, cutoff);
    for (Agent agent : agents) {
      agent.markOffline(now);
    }
    return agents.size();
  }
}
