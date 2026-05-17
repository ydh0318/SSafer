package com.ssafer.scan.domain.repository;

import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanStatus;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScanRepository extends JpaRepository<Scan, Long>, JpaSpecificationExecutor<Scan> {

  Optional<Scan> findByIdAndProjectId(Long id, Long projectId);

  Optional<Scan> findByIdAndDeletedAtIsNull(Long id);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from Scan s where s.id = :scanId and s.deletedAt is null")
  Optional<Scan> findByIdForUpdate(@Param("scanId") Long scanId);

  List<Scan> findByProjectIdAndDeletedAtIsNull(Long projectId);

  List<Scan> findByRequestedByUserIdOrderByRequestedAtDescIdDesc(Long requestedByUserId);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("update Scan s set s.rawResultPath = :rawResultPath where s.id = :scanId")
  int updateRawResultPath(@Param("scanId") Long scanId, @Param("rawResultPath") String rawResultPath);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("""
      update Scan s
         set s.rawResultPath = :rawResultPath,
             s.status = :nextStatus,
             s.progressStep = :progressStep,
             s.failureReason = :failureReason,
             s.startedAt = :startedAt,
             s.completedAt = :completedAt,
             s.lastUpdatedAt = :lastUpdatedAt
       where s.id = :scanId
         and s.deletedAt is null
         and s.status = :expectedStatus
      """)
  int updateRawResultPathAndStatusIfCurrent(
      @Param("scanId") Long scanId,
      @Param("rawResultPath") String rawResultPath,
      @Param("expectedStatus") ScanStatus expectedStatus,
      @Param("nextStatus") ScanStatus nextStatus,
      @Param("progressStep") String progressStep,
      @Param("failureReason") String failureReason,
      @Param("startedAt") LocalDateTime startedAt,
      @Param("completedAt") LocalDateTime completedAt,
      @Param("lastUpdatedAt") LocalDateTime lastUpdatedAt
  );

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("""
      update Scan s
         set s.status = :nextStatus,
             s.progressStep = :progressStep,
             s.failureReason = :failureReason,
             s.startedAt = :startedAt,
             s.completedAt = :completedAt,
             s.lastUpdatedAt = :lastUpdatedAt
       where s.id = :scanId
         and s.deletedAt is null
         and s.status = :expectedStatus
      """)
  int updateStatusIfCurrent(
      @Param("scanId") Long scanId,
      @Param("expectedStatus") ScanStatus expectedStatus,
      @Param("nextStatus") ScanStatus nextStatus,
      @Param("progressStep") String progressStep,
      @Param("failureReason") String failureReason,
      @Param("startedAt") LocalDateTime startedAt,
      @Param("completedAt") LocalDateTime completedAt,
      @Param("lastUpdatedAt") LocalDateTime lastUpdatedAt
  );
}
