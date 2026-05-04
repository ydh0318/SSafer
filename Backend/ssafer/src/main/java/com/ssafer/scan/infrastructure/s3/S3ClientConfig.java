package com.ssafer.scan.infrastructure.s3;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;

@Configuration
// raw 결과 존재 검증(HeadObject)용 S3Client 빈 설정.
public class S3ClientConfig {

  @Bean
  public S3Client s3Client(
      @Value("${APP_SCAN_RAW_S3_REGION:ap-northeast-2}") String region,
      @Value("${AWS_ACCESS_KEY_ID:}") String accessKeyId,
      @Value("${AWS_SECRET_ACCESS_KEY:}") String secretAccessKey
  ) {
    S3ClientBuilder builder = S3Client.builder()
        .region(Region.of(region));

    // AWS 자격 증명은 환경변수로 주입한다.
    if (accessKeyId.isBlank() || secretAccessKey.isBlank()) {
      throw new IllegalStateException("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must not be blank");
    }
    builder.credentialsProvider(StaticCredentialsProvider.create(
        AwsBasicCredentials.create(accessKeyId, secretAccessKey)));

    return builder.build();
  }
}
