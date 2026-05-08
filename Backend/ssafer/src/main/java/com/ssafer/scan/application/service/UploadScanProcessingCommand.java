package com.ssafer.scan.application.service;

import java.util.List;
import org.springframework.web.multipart.MultipartFile;

public record UploadScanProcessingCommand(
    Long scanId,
    Long projectId,
    // scan_result.json에 기록할 프로젝트 식별 이름
    String projectName,
    String scanName,
    List<MultipartFile> files
) {
}
