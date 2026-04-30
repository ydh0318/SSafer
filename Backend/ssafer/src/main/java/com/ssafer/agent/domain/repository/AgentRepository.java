package com.ssafer.agent.domain.repository;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentRepository extends JpaRepository<Agent, Long> {

  List<Agent> findByProjectId(Long projectId);

  Optional<Agent> findByIdAndProjectId(Long id, Long projectId);

  Optional<Agent> findFirstByProjectId(Long projectId);

  List<Agent> findByStatusAndLastSeenAtBefore(AgentStatus status, Instant before);
}
