package com.ssafer.scan.domain.repository;

import com.ssafer.scan.domain.entity.Scan;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScanRepository extends JpaRepository<Scan, Long> {

  Optional<Scan> findByIdAndProjectId(Long id, Long projectId);
}
