package com.ssafer.scan.domain.repository;

import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.Severity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScanFindingRepository extends JpaRepository<ScanFinding, Long> {

  Page<ScanFinding> findByScanId(Long scanId, Pageable pageable);

  Page<ScanFinding> findByScanIdAndSeverity(Long scanId, Severity severity, Pageable pageable);

  List<ScanFinding> findByScanIdAndScanNodeId(Long scanId, Long scanNodeId);

  Optional<ScanFinding> findByIdAndScanId(Long id, Long scanId);

  boolean existsByScanIdAndScanNodeIdAndFingerprint(Long scanId, Long scanNodeId, String fingerprint);
}
