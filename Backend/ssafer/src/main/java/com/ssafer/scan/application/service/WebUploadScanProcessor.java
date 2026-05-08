package com.ssafer.scan.application.service;

public interface WebUploadScanProcessor {

  UploadScanProcessingResult process(UploadScanProcessingCommand command);
}
