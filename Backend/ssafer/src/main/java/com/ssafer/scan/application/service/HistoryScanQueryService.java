package com.ssafer.scan.application.service;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.scan.api.dto.HistoryScanListItemResponse;
import com.ssafer.scan.api.dto.HistoryScanListResponse;
import com.ssafer.scan.domain.entity.Scan;
import com.ssafer.scan.domain.repository.ScanRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class HistoryScanQueryService {

  private final ScanRepository scanRepository;
  private final CurrentActorProvider currentActorProvider;

  @Transactional(readOnly = true)
  public HistoryScanListResponse getCurrentUserScanHistory() {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();

    // 전체 히스토리 조회는 로그인한 회원 본인의 이력만 조회하도록 제한한다.
    // 게스트는 회원 히스토리 개념이 없으므로 명시적으로 차단한다.
    if (!actor.isMember()) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    // 이번 단계에서는 현재 회원이 요청한 전체 스캔 목록을 최신순으로 그대로 조회한다.
    // 이후 커밋에서 페이지네이션, 필터, 요약 count를 이 조회 흐름 위에 확장한다.
    List<HistoryScanListItemResponse> items = scanRepository
        .findByRequestedByUserIdOrderByRequestedAtDescIdDesc(actor.userId())
        .stream()
        .map(this::toHistoryItem)
        .toList();

    return new HistoryScanListResponse(items);
  }

  private HistoryScanListItemResponse toHistoryItem(Scan scan) {
    // 히스토리 API가 먼저 열려야 하므로, 현재 시점에 보장되는 스캔 기본 필드만 응답으로 변환한다.
    return new HistoryScanListItemResponse(
        scan.getId(),
        scan.getProjectId(),
        scan.getStatus(),
        scan.getScanMode(),
        scan.getRequestedAt(),
        scan.getCompletedAt()
    );
  }
}
