package com.ssafer.scan.application.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class NoOpWebUploadScanProcessor implements WebUploadScanProcessor {

  @Override
  public void process(UploadScanProcessingCommand command) {
    // 태스크1에서는 실제 스캔 실행을 하지 않고, 요청 접수/검증/REQUESTED 생성까지만 검증한다.
    log.debug(
        "Web upload scan processing is deferred in this stage: scanId={}, projectId={}",
        command.scanId(),
        command.projectId()
    );
  }
}
