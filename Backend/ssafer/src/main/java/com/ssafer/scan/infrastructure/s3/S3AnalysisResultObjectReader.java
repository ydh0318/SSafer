package com.ssafer.scan.infrastructure.s3;

import com.ssafer.scan.application.service.AnalysisResultObjectReader;
import java.net.URI;
import java.util.Locale;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

// S3 URI에 있는 워커 분석 결과 파일을 UTF-8 문자열로 읽어오는 구현체다.
@Component
public class S3AnalysisResultObjectReader implements AnalysisResultObjectReader {

  private final S3Client s3Client;

  public S3AnalysisResultObjectReader(S3Client s3Client) {
    this.s3Client = s3Client;
  }

  @Override
  public String read(String analysisResultPath) {
    S3Location location = parse(analysisResultPath);
    ResponseBytes<GetObjectResponse> objectBytes = s3Client.getObjectAsBytes(
        GetObjectRequest.builder()
            .bucket(location.bucket())
            .key(location.key())
            .build()
    );
    return objectBytes.asUtf8String();
  }

  private S3Location parse(String analysisResultPath) {
    try {
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
    } catch (RuntimeException ex) {
      throw new IllegalArgumentException("Invalid analysisResultPath: " + analysisResultPath, ex);
    }
  }

  private record S3Location(String bucket, String key) {
  }
}
