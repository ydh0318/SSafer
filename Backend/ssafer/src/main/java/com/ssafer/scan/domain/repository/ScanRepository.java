package com.ssafer.scan.domain.repository;

import com.ssafer.scan.domain.entity.Scan;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScanRepository extends JpaRepository<Scan, Long> {

  Optional<Scan> findByIdAndProjectId(Long id, Long projectId);

  // scan 저장 후 생성된 scanId를 경로 규칙에 반영하기 위해 raw_result_path만 별도로 갱신한다.
  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("update Scan s set s.rawResultPath = :rawResultPath where s.id = :scanId")
  int updateRawResultPath(@Param("scanId") Long scanId, @Param("rawResultPath") String rawResultPath);
}
