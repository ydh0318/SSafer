package com.ssafer.agent.domain.repository;

import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AgentTaskRepository extends JpaRepository<AgentTask, Long> {

  Optional<AgentTask> findByIdAndScanId(Long id, Long scanId);

  // 결과 보고 처리 중 같은 task가 동시에 갱신되지 않도록 agentId 조건으로 잠금 조회한다.
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("""
      select task
      from AgentTask task
      where task.id = :taskId
        and task.agent.id = :agentId
      """)
  Optional<AgentTask> findByIdAndAgentIdForUpdate(
      @Param("taskId") Long taskId,
      @Param("agentId") Long agentId
  );

  // 아직 agent가 가져가지 않은 PENDING 작업만 queued_at 오름차순으로 조회할 때 사용한다.
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  List<AgentTask> findByAgentIdAndTaskStatusInOrderByQueuedAtAsc(
      Long agentId,
      Collection<AgentTaskStatus> statuses
  );

  Optional<AgentTask> findFirstByAgentIdAndTaskStatusInOrderByQueuedAtDescIdDesc(
      Long agentId,
      Collection<AgentTaskStatus> statuses
  );
}
