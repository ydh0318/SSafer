package com.ssafer.scan.domain.repository;

import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.Severity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScanFindingRepository extends JpaRepository<ScanFinding, Long> {

  long countByScanId(Long scanId);

  long countByScanIdAndSeverity(Long scanId, Severity severity);

  Page<ScanFinding> findByScanId(Long scanId, Pageable pageable);

  Page<ScanFinding> findByScanIdAndSeverity(Long scanId, Severity severity, Pageable pageable);

  // category는 문자열 컬럼이라 enum 없이도 현재 저장된 값 기준으로 바로 집계한다.
  @Query("""
      select f.category, count(f)
      from ScanFinding f
      where f.scanId = :scanId
      group by f.category
      """)
  List<Object[]> countCategoryByScanId(@Param("scanId") Long scanId);

  // sourceType별 결과 분포를 요약 카드에서 바로 보여주기 위한 집계다.
  @Query("""
      select f.sourceType, count(f)
      from ScanFinding f
      where f.scanId = :scanId
      group by f.sourceType
      """)
  List<Object[]> countSourceTypeByScanId(@Param("scanId") Long scanId);

  // 처리 상태별 개수는 후속 조치 현황을 보여줄 때 사용한다.
  @Query("""
      select f.resolutionStatus, count(f)
      from ScanFinding f
      where f.scanId = :scanId
      group by f.resolutionStatus
      """)
  List<Object[]> countResolutionStatusByScanId(@Param("scanId") Long scanId);

  List<ScanFinding> findByScanIdAndScanNodeId(Long scanId, Long scanNodeId);

  Optional<ScanFinding> findByIdAndScanId(Long id, Long scanId);

  boolean existsByScanIdAndScanNodeIdAndFingerprint(Long scanId, Long scanNodeId, String fingerprint);
}
