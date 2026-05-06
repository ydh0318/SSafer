package com.ssafer.scan.domain.repository;

import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.enums.Severity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScanFindingRepository extends JpaRepository<ScanFinding, Long>,
    JpaSpecificationExecutor<ScanFinding> {

  long countByScanId(Long scanId);

  long countByScanIdAndSeverity(Long scanId, Severity severity);

  List<ScanFinding> findAllByScanId(Long scanId);

  // 히스토리 목록 item에서 현재 페이지에 포함된 scanId들만 대상으로 위험도 분포를 집계한다.
  // page size가 20이면 여기도 그 20건만 대상으로 count를 계산해 불필요한 전체 집계를 막는다.
  @Query("""
      select f.scanId, f.severity, count(f)
      from ScanFinding f
      where f.scanId in :scanIds
      group by f.scanId, f.severity
      """)
  List<Object[]> countSeverityByScanIds(@Param("scanIds") List<Long> scanIds);

  // 히스토리 summary는 페이지 item과 별개로 현재 필터 전체 결과 기준의 위험도 통계가 필요하다.
  // 그래서 Scan 엔티티 전체를 메모리로 읽지 않고 DB에서 바로 severity별 aggregate 결과만 가져온다.
  @Query("""
      select f.severity, count(f)
      from ScanFinding f, Scan s
      where f.scanId = s.id
        and s.projectId in :projectIds
        and (:status is null or s.status = :status)
        and (:scanMode is null or s.scanMode = :scanMode)
      group by f.severity
      """)
  List<Object[]> countSeveritySummaryForHistory(
      @Param("projectIds") List<Long> projectIds,
      @Param("status") ScanStatus status,
      @Param("scanMode") ScanMode scanMode
  );

  // severity 분포는 요약 카드에서 자주 쓰이므로 DB의 group by 결과로 모은다.
  @Query("""
      select f.severity, count(f)
      from ScanFinding f
      where f.scanId = :scanId
      group by f.severity
      """)
  List<Object[]> countSeverityByScanId(@Param("scanId") Long scanId);

  Page<ScanFinding> findByScanId(Long scanId, Pageable pageable);

  Page<ScanFinding> findByScanIdAndSeverity(Long scanId, Severity severity, Pageable pageable);

  // category는 문자열 컬럼이므로 현재 등록된 값 기준으로 바로 집계한다.
  @Query("""
      select f.category, count(f)
      from ScanFinding f
      where f.scanId = :scanId
      group by f.category
      """)
  List<Object[]> countCategoryByScanId(@Param("scanId") Long scanId);

  // sourceType별 분포를 요약 카드에서 바로 보여주기 위한 집계다.
  @Query("""
      select f.sourceType, count(f)
      from ScanFinding f
      where f.scanId = :scanId
      group by f.sourceType
      """)
  List<Object[]> countSourceTypeByScanId(@Param("scanId") Long scanId);

  // 처리 상태별 개수는 후속 조치 현황을 보여주는 데 사용한다.
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
