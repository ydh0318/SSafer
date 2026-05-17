package com.ssafer.worker.domain.repository;

import com.ssafer.worker.domain.entity.WorkerJob;
import com.ssafer.worker.domain.enums.WorkerJobStatus;
import com.ssafer.worker.domain.enums.WorkerJobType;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkerJobRepository extends JpaRepository<WorkerJob, Long> {

  Optional<WorkerJob> findByIdAndScanId(Long id, Long scanId);

  Optional<WorkerJob> findFirstByScanIdAndJobTypeOrderByQueuedAtDescIdDesc(Long scanId, WorkerJobType jobType);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("""
      select job
      from WorkerJob job
      where job.id = :jobId
        and job.scan.id = :scanId
      """)
  Optional<WorkerJob> findByIdAndScanIdForUpdate(
      @Param("jobId") Long jobId,
      @Param("scanId") Long scanId
  );

  List<WorkerJob> findByJobStatusInOrderByQueuedAtAsc(Collection<WorkerJobStatus> statuses);
}
