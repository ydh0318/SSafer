package com.ssafer.scan.domain.repository;

import com.ssafer.scan.domain.entity.ScanNode;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScanNodeRepository extends JpaRepository<ScanNode, Long> {

  long countByScanId(Long scanId);

  List<ScanNode> findByScanId(Long scanId);

  Optional<ScanNode> findByIdAndScanId(Long id, Long scanId);

  boolean existsByIdAndScanId(Long id, Long scanId);
}
