package com.ssafer.project.domain.repository;

import com.ssafer.project.domain.entity.Project;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, Long> {

  Optional<Project> findByIdAndDeletedAtIsNull(Long projectId);

  Page<Project> findByUserIdAndDeletedAtIsNull(Long userId, Pageable pageable);

  Page<Project> findByGuestOwnerKeyHashAndDeletedAtIsNull(String guestOwnerKeyHash, Pageable pageable);
}
