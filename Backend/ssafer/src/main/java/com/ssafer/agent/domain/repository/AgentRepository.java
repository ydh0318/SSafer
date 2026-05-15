package com.ssafer.agent.domain.repository;

import com.ssafer.agent.domain.entity.Agent;
import com.ssafer.agent.domain.enums.AgentStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AgentRepository extends JpaRepository<Agent, Long> {

  List<Agent> findByProjectId(Long projectId);

  Optional<Agent> findByIdAndProjectId(Long id, Long projectId);

  Optional<Agent> findFirstByProjectId(Long projectId);

  @Query("""
      select agent
      from Agent agent
      where agent.project.id = :projectId
        and agent.status = :status
      order by
        case when agent.lastSeenAt is null then 1 else 0 end,
        agent.lastSeenAt desc,
        agent.id desc
      """)
  Optional<Agent> findLatestByProjectIdAndStatus(
      @Param("projectId") Long projectId,
      @Param("status") AgentStatus status
  );

  Optional<Agent> findByAuthTokenHash(String authTokenHash);

  List<Agent> findByStatusAndLastSeenAtBefore(AgentStatus status, Instant before);

  // scan-options API에서 "해당 프로젝트에 ONLINE Local Agent가 있는지" 빠르게 판단할 때 사용한다.
  boolean existsByProjectIdAndStatus(Long projectId, AgentStatus status);
}
