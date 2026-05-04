package com.ssafer.scan.domain.repository;

import com.ssafer.scan.domain.entity.Scan;
import jakarta.persistence.LockModeType;
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

  // 같은 scanId로 완료 보고가 동시에 들어오면 한 트랜잭션씩 순차 처리되도록 row lock 조회를 사용한다.
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from Scan s where s.id = :scanId")
  Optional<Scan> findByIdForUpdate(@Param("scanId") Long scanId);

  // 히스토리 API에서 특정 사용자가 요청한 scan을 최신순으로 조회한다.
  List<Scan> findByRequestedByUserIdOrderByRequestedAtDescIdDesc(Long requestedByUserId);

  // scan 생성 직후 raw result 저장 경로를 별도로 반영할 때 사용한다.
  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("update Scan s set s.rawResultPath = :rawResultPath where s.id = :scanId")
  int updateRawResultPath(@Param("scanId") Long scanId, @Param("rawResultPath") String rawResultPath);
}
