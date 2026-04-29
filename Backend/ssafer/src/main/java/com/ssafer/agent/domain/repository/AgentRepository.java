package com.ssafer.agent.domain.repository;

import com.ssafer.agent.domain.entity.Agent;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentRepository extends JpaRepository<Agent, Long> {

  List<Agent> findByProjectId(Long projectId);
}
