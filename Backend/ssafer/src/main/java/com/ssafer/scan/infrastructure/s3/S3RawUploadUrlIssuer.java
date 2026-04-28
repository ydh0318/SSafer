package com.ssafer.scan.infrastructure.s3;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.scan.application.service.RawUploadUrlIssuer;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Component
@RequiredArgsConstructor
// raw 결과 업로드용 S3 presigned PUT URL을 발급한다.
public class S3RawUploadUrlIssuer implements RawUploadUrlIssuer {

  private final S3Presigner s3Presigner;

  @Value("${APP_SCAN_RAW_S3_BUCKET:ssafer}")
  private String rawResultBucket;

  @Value("${APP_SCAN_RAW_PRESIGNED_EXPIRES_MINUTES:10}")
  private long expiresMinutes;

  @Override
  public String issuePutUrl(String objectKey) {
    try {
      PutObjectRequest putObjectRequest = PutObjectRequest.builder()
          .bucket(rawResultBucket)
          .key(objectKey)
          .contentType("application/json")
          .build();

      PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
          .signatureDuration(Duration.ofMinutes(expiresMinutes))
          .putObjectRequest(putObjectRequest)
          .build();

      PresignedPutObjectRequest presigned = s3Presigner.presignPutObject(presignRequest);
      return presigned.url().toString();
    } catch (Exception ex) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }
}
