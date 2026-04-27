package com.ssafer.project.domain.repository;

import com.ssafer.project.domain.entity.Project;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, Long> {

  Optional<Project> findByIdAndDeletedAtIsNull(Long projectId);

  Page<Project> findByUserIdAndDeletedAtIsNull(Long userId, Pageable pageable);

  Page<Project> findByGuestOwnerKeyHashAndDeletedAtIsNull(String guestOwnerKeyHash, Pageable pageable);

  // 스캔 시작 시 owner+projectName 매칭을 위해 소유자 범위의 활성 프로젝트를 모두 조회한다.
  List<Project> findByUserIdAndDeletedAtIsNull(Long userId);

  // 게스트 소유 범위도 동일한 방식으로 활성 프로젝트를 조회한다.
  List<Project> findByGuestOwnerKeyHashAndDeletedAtIsNull(String guestOwnerKeyHash);
}
