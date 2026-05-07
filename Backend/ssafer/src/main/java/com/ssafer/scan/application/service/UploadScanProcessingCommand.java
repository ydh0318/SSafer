package com.ssafer.scan.application.service;

import java.util.List;
import org.springframework.web.multipart.MultipartFile;

public record UploadScanProcessingCommand(
    Long scanId,
    Long projectId,
    String scanName,
    List<MultipartFile> files
) {
}
