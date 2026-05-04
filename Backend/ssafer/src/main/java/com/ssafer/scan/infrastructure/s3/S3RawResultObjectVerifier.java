package com.ssafer.scan.infrastructure.s3;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.scan.application.service.RawResultObjectVerifier;
import java.net.URI;
import java.util.Locale;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Component
// RawResultObjectVerifier의 S3 구현체. HeadObject로 객체 존재만 점검한다.
public class S3RawResultObjectVerifier implements RawResultObjectVerifier {

  private final S3Client s3Client;

  public S3RawResultObjectVerifier(S3Client s3Client) {
    this.s3Client = s3Client;
  }

  @Override
  public boolean exists(String rawResultPath) {
    S3Location location = parse(rawResultPath);
    try {
      s3Client.headObject(HeadObjectRequest.builder()
          .bucket(location.bucket())
          .key(location.key())
          .build());
      return true;
    } catch (NoSuchKeyException ex) {
      return false;
    } catch (S3Exception ex) {
      // S3에서 404는 "객체 없음"으로 처리하고, 그 외는 인프라 오류로 본다.
      if (ex.statusCode() == 404) {
        return false;
      }
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    } catch (SdkException ex) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }

  private S3Location parse(String rawResultPath) {
    try {
      URI uri = URI.create(rawResultPath);
      if (!"s3".equalsIgnoreCase(uri.getScheme())) {
        throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
      }
      String bucket = uri.getHost();
      String key = uri.getPath() != null ? uri.getPath().replaceFirst("^/", "") : "";
      if (bucket == null || bucket.isBlank() || key.isBlank()) {
        throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
      }
      return new S3Location(bucket.toLowerCase(Locale.ROOT), key);
    } catch (IllegalArgumentException ex) {
      throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
    }
  }

  private record S3Location(String bucket, String key) {
  }
}
