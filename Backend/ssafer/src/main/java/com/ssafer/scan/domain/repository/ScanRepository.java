package com.ssafer.scan.domain.repository;

import com.ssafer.scan.domain.entity.Scan;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScanRepository extends JpaRepository<Scan, Long>, JpaSpecificationExecutor<Scan> {

  Optional<Scan> findByIdAndProjectId(Long id, Long projectId);

  // 전체 히스토리 API에서 회원이 직접 요청한 스캔만 최신순으로 모아온다.
  List<Scan> findByRequestedByUserIdOrderByRequestedAtDescIdDesc(Long requestedByUserId);

  // scan 저장 후 생성된 scanId를 경로 규칙에 반영하기 위해 raw_result_path만 별도로 갱신한다.
  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("update Scan s set s.rawResultPath = :rawResultPath where s.id = :scanId")
  int updateRawResultPath(@Param("scanId") Long scanId, @Param("rawResultPath") String rawResultPath);
}
