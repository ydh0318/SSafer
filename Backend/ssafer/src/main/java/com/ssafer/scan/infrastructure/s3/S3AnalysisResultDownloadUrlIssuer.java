package com.ssafer.scan.infrastructure.s3;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.scan.application.service.AnalysisResultDownloadUrl;
import com.ssafer.scan.application.service.AnalysisResultDownloadUrlIssuer;
import java.net.URI;
import java.time.Duration;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

@Component
@RequiredArgsConstructor
// analysisResultPath(s3://bucket/key)를 실제 S3 Presigned GET URL로 변환한다.
public class S3AnalysisResultDownloadUrlIssuer implements AnalysisResultDownloadUrlIssuer {

  private final S3Presigner s3Presigner;

  @Value("${APP_ANALYSIS_RESULT_PRESIGNED_EXPIRES_MINUTES:10}")
  private long expiresMinutes;

  @Override
  public AnalysisResultDownloadUrl issueGetUrl(String analysisResultPath) {
    try {
      // scan row에는 S3 URI 전체가 저장되므로 bucket/key를 분리해 S3 SDK 요청으로 변환한다.
      S3Location location = parse(analysisResultPath);
      GetObjectRequest getObjectRequest = GetObjectRequest.builder()
          .bucket(location.bucket())
          .key(location.key())
          .build();

      Duration signatureDuration = Duration.ofMinutes(expiresMinutes);
      GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
          .signatureDuration(signatureDuration)
          .getObjectRequest(getObjectRequest)
          .build();

      PresignedGetObjectRequest presigned = s3Presigner.presignGetObject(presignRequest);
      return new AnalysisResultDownloadUrl(presigned.url().toString(), signatureDuration.toSeconds());
    } catch (Exception ex) {
      // 잘못된 S3 URI나 Presigner 오류는 서버 저장 데이터/인프라 문제로 처리한다.
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }

  private S3Location parse(String analysisResultPath) {
    URI uri = URI.create(analysisResultPath);
    if (!"s3".equalsIgnoreCase(uri.getScheme())) {
      throw new IllegalArgumentException("analysisResultPath must use s3 scheme");
    }
    String bucket = uri.getHost();
    String key = uri.getPath();
    if (bucket == null || bucket.isBlank() || key == null || key.isBlank() || "/".equals(key)) {
      throw new IllegalArgumentException("analysisResultPath must include bucket and object key");
    }
    return new S3Location(bucket.toLowerCase(Locale.ROOT), key.startsWith("/") ? key.substring(1) : key);
  }

  private record S3Location(String bucket, String key) {
  }
}
