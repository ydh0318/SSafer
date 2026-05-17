package com.ssafer.worker.domain.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ssafer.project.domain.entity.Project;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.RequestActorType;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.ScanType;
import com.ssafer.worker.domain.entity.WorkerJob;
import com.ssafer.worker.domain.enums.WorkerJobStatus;
import com.ssafer.worker.domain.enums.WorkerJobType;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class WorkerJobRepositoryTest {

  @Autowired
  private WorkerJobRepository workerJobRepository;

  @Autowired
  private EntityManager entityManager;

  @Test
  void findFirstByScanIdAndJobTypeOrderByQueuedAtDescIdDescReturnsNewestJob() {
    Project project = new Project(40L, null, "project-worker", null, com.ssafer.project.domain.enums.ScanMode.UPLOAD, false);
    entityManager.persist(project);
    entityManager.flush();

    Scan scan = Scan.builder()
        .projectId(project.getId())
        .requestedByUserId(40L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.UPLOAD)
        .scanType(ScanType.PROJECT_FILE)
        .status(ScanStatus.REQUESTED)
        .requestedAt(LocalDateTime.now().minusMinutes(3))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(3))
        .build();
    entityManager.persist(scan);
    entityManager.flush();

    WorkerJob first = workerJobRepository.save(new WorkerJob(
        project,
        scan,
        WorkerJobType.UPLOAD_ANALYSIS_REQUEST,
        WorkerJobStatus.PENDING,
        "{\"scanId\":" + scan.getId() + "}"
    ));
    WorkerJob second = workerJobRepository.save(new WorkerJob(
        project,
        scan,
        WorkerJobType.UPLOAD_ANALYSIS_REQUEST,
        WorkerJobStatus.PUBLISHED,
        "{\"scanId\":" + scan.getId() + ",\"attempt\":2}"
    ));

    ReflectionTestUtils.setField(first, "queuedAt", Instant.parse("2026-05-17T00:00:01Z"));
    ReflectionTestUtils.setField(second, "queuedAt", Instant.parse("2026-05-17T00:00:02Z"));
    entityManager.flush();
    entityManager.clear();

    WorkerJob found = workerJobRepository.findFirstByScanIdAndJobTypeOrderByQueuedAtDescIdDesc(
            scan.getId(),
            WorkerJobType.UPLOAD_ANALYSIS_REQUEST
        )
        .orElseThrow();

    assertThat(found.getId()).isEqualTo(second.getId());
  }

  @Test
  void findByJobStatusInOrderByQueuedAtAscReturnsPendingAndPublishedJobsInOrder() {
    Project project = new Project(41L, null, "project-worker-queue", null, com.ssafer.project.domain.enums.ScanMode.UPLOAD, false);
    entityManager.persist(project);
    entityManager.flush();

    Scan firstScan = Scan.builder()
        .projectId(project.getId())
        .requestedByUserId(41L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.UPLOAD)
        .status(ScanStatus.REQUESTED)
        .requestedAt(LocalDateTime.now().minusMinutes(5))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(5))
        .build();
    Scan secondScan = Scan.builder()
        .projectId(project.getId())
        .requestedByUserId(41L)
        .requestActorType(RequestActorType.USER)
        .scanMode(com.ssafer.scan.domain.enums.ScanMode.UPLOAD)
        .status(ScanStatus.REQUESTED)
        .requestedAt(LocalDateTime.now().minusMinutes(4))
        .lastUpdatedAt(LocalDateTime.now().minusMinutes(4))
        .build();
    entityManager.persist(firstScan);
    entityManager.persist(secondScan);
    entityManager.flush();

    WorkerJob first = workerJobRepository.save(new WorkerJob(
        project,
        firstScan,
        WorkerJobType.UPLOAD_ANALYSIS_REQUEST,
        WorkerJobStatus.PENDING,
        null
    ));
    WorkerJob second = workerJobRepository.save(new WorkerJob(
        project,
        secondScan,
        WorkerJobType.UPLOAD_ANALYSIS_REQUEST,
        WorkerJobStatus.PUBLISHED,
        null
    ));
    workerJobRepository.save(new WorkerJob(
        project,
        secondScan,
        WorkerJobType.UPLOAD_ANALYSIS_REQUEST,
        WorkerJobStatus.SUCCEEDED,
        null
    ));

    ReflectionTestUtils.setField(first, "queuedAt", Instant.parse("2026-05-17T00:00:01Z"));
    ReflectionTestUtils.setField(second, "queuedAt", Instant.parse("2026-05-17T00:00:02Z"));
    entityManager.flush();
    entityManager.clear();

    List<WorkerJob> found = workerJobRepository.findByJobStatusInOrderByQueuedAtAsc(
        List.of(WorkerJobStatus.PENDING, WorkerJobStatus.PUBLISHED)
    );

    assertThat(found).extracting(WorkerJob::getId).containsExactly(first.getId(), second.getId());
  }
}
