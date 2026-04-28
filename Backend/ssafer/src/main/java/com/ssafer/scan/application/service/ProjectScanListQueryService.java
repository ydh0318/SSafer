package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ProjectScanListItemResponse;
import com.ssafer.scan.api.dto.ProjectScanListResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.enums.ScanMode;
import com.ssafer.scan.domain.enums.ScanStatus;
import com.ssafer.scan.domain.repository.ScanRepository;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProjectScanListQueryService {

  private static final int DEFAULT_PAGE = 0;
  private static final int DEFAULT_SIZE = 20;
  private static final int MAX_SIZE = 100;

  private final ScanRepository scanRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional(readOnly = true)
  public ProjectScanListResponse getProjectScans(
      Long projectId,
      Integer page,
      Integer size,
      ScanStatus status,
      ScanMode scanMode
  ) {
    // 프로젝트 존재 여부와 요청 주체의 접근 권한을 먼저 검증한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    projectAuthorizationService.loadAuthorizedProjectOrThrow(projectId, actor);

    Pageable pageable = buildPageable(page, size);
    Page<Scan> scanPage = scanRepository.findAll(
        buildSpecification(projectId, status, scanMode),
        pageable
    );

    // 목록 API에 필요한 필드만 DTO로 투영해 반환한다.
    List<ProjectScanListItemResponse> items = scanPage.getContent().stream()
        .map(scan -> new ProjectScanListItemResponse(
            scan.getId(),
            scan.getStatus(),
            scan.getScanMode(),
            scan.getRequestedAt(),
            scan.getCompletedAt()
        ))
        .toList();

    return new ProjectScanListResponse(
        items,
        scanPage.getNumber(),
        scanPage.getSize(),
        scanPage.getTotalElements(),
        scanPage.getTotalPages()
    );
  }

  private Pageable buildPageable(Integer page, Integer size) {
    int normalizedPage = page == null ? DEFAULT_PAGE : page;
    int normalizedSize = size == null ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
    if (normalizedPage < 0 || normalizedSize < 1) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    // 최신 요청 건이 앞에 오도록 requestedAt DESC, 동률은 id DESC로 고정한다.
    return PageRequest.of(
        normalizedPage,
        normalizedSize,
        Sort.by(Sort.Order.desc("requestedAt"), Sort.Order.desc("id"))
    );
  }

  private Specification<Scan> buildSpecification(Long projectId, ScanStatus status, ScanMode scanMode) {
    return (root, query, criteriaBuilder) -> {
      List<Predicate> predicates = new ArrayList<>();
      predicates.add(criteriaBuilder.equal(root.get("projectId"), projectId));
      if (status != null) {
        predicates.add(criteriaBuilder.equal(root.get("status"), status));
      }
      if (scanMode != null) {
        predicates.add(criteriaBuilder.equal(root.get("scanMode"), scanMode));
      }
      return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
    };
  }
}
