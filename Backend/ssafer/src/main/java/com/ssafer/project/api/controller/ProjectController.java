package com.ssafer.project.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.project.api.dto.CreateProjectRequest;
import com.ssafer.project.api.dto.ProjectDetailResponseData;
import com.ssafer.project.api.dto.ProjectIdResponseData;
import com.ssafer.project.api.dto.ProjectListItemData;
import com.ssafer.project.api.dto.ProjectListResponseData;
import com.ssafer.project.application.service.ProjectManagementService;
import com.ssafer.project.domain.entity.Project;
import com.ssafer.project.domain.enums.ScanMode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/v1/projects")
@Tag(name = "프로젝트 관리", description = "프로젝트 생성/조회/수정/삭제 API")
public class ProjectController {

  private static final String CREATED_MESSAGE = "프로젝트 생성 성공";
  private static final String DETAIL_MESSAGE = "프로젝트 상세 조회 성공";
  private static final String LIST_MESSAGE = "프로젝트 목록 조회 성공";
  private static final String UPDATED_MESSAGE = "프로젝트 수정 성공";
  private static final String DELETED_MESSAGE = "프로젝트 삭제 성공";

  private final CurrentActorProvider currentActorProvider;
  private final ProjectManagementService projectManagementService;

  public ProjectController(
      CurrentActorProvider currentActorProvider,
      ProjectManagementService projectManagementService
  ) {
    this.currentActorProvider = currentActorProvider;
    this.projectManagementService = projectManagementService;
  }

  @PostMapping
  @Operation(summary = "프로젝트 생성", description = "회원/게스트 토큰 기준으로 새 프로젝트를 생성합니다.")
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201", description = "프로젝트 생성 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "요청 값이 유효하지 않음 (INVALID_PARAMETER)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요하거나 토큰이 유효하지 않음 (UNAUTHORIZED)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "서버 내부 오류 (INTERNAL_SERVER_ERROR)")
  })
  public ResponseEntity<ApiResponse<ProjectIdResponseData>> createProject(
      @RequestBody(required = false) CreateProjectRequest request
  ) {
    // 생성 API는 body 자체가 없으면 잘못된 요청으로 처리한다.
    if (request == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Long projectId = projectManagementService.createProject(
        actor,
        request.name(),
        request.description(),
        request.defaultScanMode(),
        request.monitorEnabled()
    );

    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.success(CREATED_MESSAGE, new ProjectIdResponseData(projectId)));
  }

  @GetMapping("/{projectId}")
  @Operation(summary = "프로젝트 상세 조회", description = "요청자가 소유한 프로젝트의 상세 정보를 조회합니다.")
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "프로젝트 상세 조회 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요하거나 토큰이 유효하지 않음 (UNAUTHORIZED)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "접근 권한 없음 (FORBIDDEN)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "프로젝트를 찾을 수 없음 (NOT_FOUND)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "서버 내부 오류 (INTERNAL_SERVER_ERROR)")
  })
  public ResponseEntity<ApiResponse<ProjectDetailResponseData>> getProjectDetail(
      @Parameter(description = "프로젝트 ID", example = "101")
      @PathVariable Long projectId
  ) {
    // 상세 조회는 service에서 소유권/삭제 여부를 함께 검증한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Project project = projectManagementService.getProjectDetail(actor, projectId);
    ProjectDetailResponseData data = new ProjectDetailResponseData(
        project.getId(),
        project.getName(),
        project.getDescription(),
        project.getDefaultScanMode(),
        project.isMonitorEnabled(),
        project.getCreatedAt(),
        project.getUpdatedAt()
    );
    return ResponseEntity.ok(ApiResponse.success(DETAIL_MESSAGE, data));
  }

  @GetMapping
  @Operation(summary = "프로젝트 목록 조회", description = "요청자가 접근 가능한 프로젝트 목록을 페이지 단위로 조회합니다.")
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "프로젝트 목록 조회 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "요청 값이 유효하지 않음 (INVALID_PARAMETER)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요하거나 토큰이 유효하지 않음 (UNAUTHORIZED)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "서버 내부 오류 (INTERNAL_SERVER_ERROR)")
  })
  public ResponseEntity<ApiResponse<ProjectListResponseData>> getProjects(
      @Parameter(description = "페이지 번호(기본값 0)", example = "0")
      @RequestParam(defaultValue = "0") Integer page,
      @Parameter(description = "페이지 크기(기본값 20, 최대 100)", example = "20")
      @RequestParam(defaultValue = "20") Integer size
  ) {
    // 목록은 "현재 요청자 기준 접근 가능한 프로젝트"만 반환한다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Page<Project> projects = projectManagementService.getProjects(actor, page, size);

    List<ProjectListItemData> items = projects.getContent().stream()
        .map(project -> new ProjectListItemData(
            project.getId(),
            project.getName(),
            project.getDefaultScanMode(),
            project.isMonitorEnabled(),
            project.getCreatedAt()
        ))
        .toList();

    ProjectListResponseData data = new ProjectListResponseData(
        items,
        projects.getNumber(),
        projects.getSize(),
        projects.getTotalElements(),
        projects.getTotalPages()
    );
    return ResponseEntity.ok(ApiResponse.success(LIST_MESSAGE, data));
  }

  @PatchMapping("/{projectId}")
  @Operation(summary = "프로젝트 수정", description = "요청 본문에 포함된 필드만 수정합니다.")
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "프로젝트 수정 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "요청 값이 유효하지 않음 (INVALID_PARAMETER)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요하거나 토큰이 유효하지 않음 (UNAUTHORIZED)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "접근 권한 없음 (FORBIDDEN)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "프로젝트를 찾을 수 없음 (NOT_FOUND)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "서버 내부 오류 (INTERNAL_SERVER_ERROR)")
  })
  public ResponseEntity<ApiResponse<ProjectIdResponseData>> updateProject(
      @Parameter(description = "프로젝트 ID", example = "101")
      @PathVariable Long projectId,
      @RequestBody(required = false) JsonNode body
  ) {
    // PATCH는 JSON Object만 허용하며, {} 빈 객체는 INVALID_PARAMETER로 처리한다.
    if (body == null || !body.isObject()) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    boolean nameProvided = body.has("name");
    boolean descriptionProvided = body.has("description");
    boolean defaultScanModeProvided = body.has("defaultScanMode");
    boolean monitorEnabledProvided = body.has("monitorEnabled");

    String name = readStringNode(body, "name");
    String description = readNullableStringNode(body, "description");
    ScanMode defaultScanMode = readNullableScanModeNode(body, "defaultScanMode");
    Boolean monitorEnabled = readNullableBooleanNode(body, "monitorEnabled");

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    Long updatedProjectId = projectManagementService.updateProject(
        actor,
        projectId,
        nameProvided,
        name,
        descriptionProvided,
        description,
        defaultScanModeProvided,
        defaultScanMode,
        monitorEnabledProvided,
        monitorEnabled
    );
    return ResponseEntity.ok(ApiResponse.success(UPDATED_MESSAGE, new ProjectIdResponseData(updatedProjectId)));
  }

  @DeleteMapping("/{projectId}")
  @Operation(summary = "프로젝트 삭제", description = "프로젝트를 soft delete 처리합니다.")
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "프로젝트 삭제 성공"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증이 필요하거나 토큰이 유효하지 않음 (UNAUTHORIZED)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "접근 권한 없음 (FORBIDDEN)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "프로젝트를 찾을 수 없음 (NOT_FOUND)"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "서버 내부 오류 (INTERNAL_SERVER_ERROR)")
  })
  public ResponseEntity<ApiResponse<Void>> deleteProject(
      @Parameter(description = "프로젝트 ID", example = "101")
      @PathVariable Long projectId
  ) {
    // 실제 row 삭제가 아니라 deleted_at을 채우는 soft delete 정책이다.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    projectManagementService.deleteProject(actor, projectId);
    return ResponseEntity.ok(ApiResponse.success(DELETED_MESSAGE, null));
  }

  private String readStringNode(JsonNode body, String fieldName) {
    JsonNode node = body.get(fieldName);
    if (node == null) {
      return null;
    }
    if (!node.isTextual()) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return node.asText();
  }

  private String readNullableStringNode(JsonNode body, String fieldName) {
    JsonNode node = body.get(fieldName);
    if (node == null || node.isNull()) {
      return null;
    }
    if (!node.isTextual()) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return node.asText();
  }

  private ScanMode readNullableScanModeNode(JsonNode body, String fieldName) {
    JsonNode node = body.get(fieldName);
    if (node == null || node.isNull()) {
      return null;
    }
    if (!node.isTextual()) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    try {
      return ScanMode.valueOf(node.asText());
    } catch (IllegalArgumentException ex) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
  }

  private Boolean readNullableBooleanNode(JsonNode body, String fieldName) {
    JsonNode node = body.get(fieldName);
    if (node == null || node.isNull()) {
      return null;
    }
    if (!node.isBoolean()) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }
    return node.asBoolean();
  }
}
