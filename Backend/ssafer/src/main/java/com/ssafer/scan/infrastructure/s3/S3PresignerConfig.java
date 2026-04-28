package com.ssafer.scan.infrastructure.s3;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
// AWS S3 Presigner를 스프링 빈으로 등록한다.
public class S3PresignerConfig {

  @Bean
  public S3Presigner s3Presigner(
      @Value("${APP_SCAN_RAW_S3_REGION:ap-northeast-2}") String region,
      @Value("${AWS_ACCESS_KEY_ID:}") String accessKeyId,
      @Value("${AWS_SECRET_ACCESS_KEY:}") String secretAccessKey
  ) {
    S3Presigner.Builder builder = S3Presigner.builder()
        .region(Region.of(region));

    // .env로 주입한 키를 우선 사용한다.
    // 값이 없으면 EC2/ECS Role, aws profile 등 기본 자격증명 체인으로 fallback 한다.
    if (!accessKeyId.isBlank() && !secretAccessKey.isBlank()) {
      builder.credentialsProvider(StaticCredentialsProvider.create(
          AwsBasicCredentials.create(accessKeyId, secretAccessKey)));
    } else {
      builder.credentialsProvider(DefaultCredentialsProvider.create());
    }

    return builder.build();
  }
}
