package com.ssafer.scan.infrastructure.s3;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
// AWS S3 Presigner를 스프링 빈으로 등록한다.
public class S3PresignerConfig {

  @Bean
  public S3Presigner s3Presigner(@Value("${APP_SCAN_RAW_S3_REGION:ap-northeast-2}") String region) {
    return S3Presigner.builder()
        .region(Region.of(region))
        .build();
  }
}
