package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.application.service.ProjectAuthorizationService;
import com.ssafer.scan.api.dto.ScanFindingListItemResponse;
import com.ssafer.scan.api.dto.ScanFindingListResponseData;
import com.ssafer.scan.api.mapper.ScanFindingListResponseMapper;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.entity.ScanFinding;
import com.ssafer.scan.domain.enums.FindingSourceType;
import com.ssafer.scan.domain.enums.ResolutionStatus;
import com.ssafer.scan.domain.enums.Severity;
import com.ssafer.scan.domain.repository.ScanFindingRepository;
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
public class ScanFindingListQueryService {

  private static final int DEFAULT_PAGE = 0;
  private static final int DEFAULT_SIZE = 20;
  private static final int MAX_SIZE = 100;

  private final ScanRepository scanRepository;
  private final ScanFindingRepository scanFindingRepository;
  private final CurrentActorProvider currentActorProvider;
  private final ProjectAuthorizationService projectAuthorizationService;

  @Transactional(readOnly = true)
  public ScanFindingListResponseData getScanFindings(
      Long scanId,
      Severity severity,
      String category,
      FindingSourceType sourceType,
      ResolutionStatus resolutionStatus,
      Long scanNodeId,
      Integer page,
      Integer size
  ) {
    // 목록 조회도 먼저 현재 요청 주체를 구한 뒤 스캔이 속한 프로젝트 접근 권한을 검사한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Scan scan = scanRepository.findById(scanId)
        .filter(found -> !found.isDeleted())
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

    projectAuthorizationService.loadAuthorizedProjectOrThrow(scan.getProjectId(), actor);

    Pageable pageable = buildPageable(page, size);
    Page<ScanFinding> findingPage = scanFindingRepository.findAll(
        buildSpecification(scanId, severity, category, sourceType, resolutionStatus, scanNodeId),
        pageable
    );

    List<ScanFindingListItemResponse> items = findingPage.getContent().stream()
        .map(ScanFindingListResponseMapper::toResponse)
        .toList();

    return new ScanFindingListResponseData(
        items,
        findingPage.getNumber(),
        findingPage.getSize(),
        findingPage.getTotalElements(),
        findingPage.getTotalPages()
    );
  }

  private Pageable buildPageable(Integer page, Integer size) {
    int normalizedPage = page == null ? DEFAULT_PAGE : page;
    int normalizedSize = size == null ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

    if (normalizedPage < 0 || normalizedSize < 1) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    // 최신 생성 순이 우선이고, 같은 시각 데이터는 id로 한 번 더 고정해 순서를 안정화한다.
    return PageRequest.of(
        normalizedPage,
        normalizedSize,
        Sort.by(
            Sort.Order.desc("createdAt"),
            Sort.Order.desc("id")
        )
    );
  }

  private Specification<ScanFinding> buildSpecification(
      Long scanId,
      Severity severity,
      String category,
      FindingSourceType sourceType,
      ResolutionStatus resolutionStatus,
      Long scanNodeId
  ) {
    return (root, query, criteriaBuilder) -> {
      List<Predicate> predicates = new ArrayList<>();
      predicates.add(criteriaBuilder.equal(root.get("scanId"), scanId));

      if (severity != null) {
        predicates.add(criteriaBuilder.equal(root.get("severity"), severity));
      }
      if (category != null && !category.isBlank()) {
        predicates.add(criteriaBuilder.equal(root.get("category"), category.trim()));
      }
      if (sourceType != null) {
        predicates.add(criteriaBuilder.equal(root.get("sourceType"), sourceType));
      }
      if (resolutionStatus != null) {
        predicates.add(criteriaBuilder.equal(root.get("resolutionStatus"), resolutionStatus));
      }
      if (scanNodeId != null) {
        predicates.add(criteriaBuilder.equal(root.get("scanNodeId"), scanNodeId));
      }

      return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
    };
  }
}
