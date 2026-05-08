package com.ssafer.agent.domain.repository;

import com.ssafer.agent.domain.entity.AgentTask;
import com.ssafer.agent.domain.enums.AgentTaskStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;

public interface AgentTaskRepository extends JpaRepository<AgentTask, Long> {

  Optional<AgentTask> findByIdAndScanId(Long id, Long scanId);

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
