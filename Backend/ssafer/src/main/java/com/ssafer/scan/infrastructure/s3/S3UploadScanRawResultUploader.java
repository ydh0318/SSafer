package com.ssafer.scan.infrastructure.s3;

import com.ssafer.scan.application.service.UploadScanRawResultUploader;
import com.ssafer.scan.application.service.UploadScanS3UploadException;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Component
public class S3UploadScanRawResultUploader implements UploadScanRawResultUploader {

  private final S3Client s3Client;
  private final String bucket;

  public S3UploadScanRawResultUploader(
      S3Client s3Client,
      @Value("${APP_SCAN_RAW_S3_BUCKET:ssafer}") String bucket
  ) {
    this.s3Client = s3Client;
    this.bucket = bucket;
  }

  @Override
  public String upload(Long scanId, Path scanResultJsonPath) {
    String objectKey = "raw/" + scanId + "/" + UUID.randomUUID() + "/scan_result.json";
    try {
      s3Client.putObject(
          PutObjectRequest.builder()
              .bucket(bucket)
              .key(objectKey)
              .contentType("application/json")
              .build(),
          RequestBody.fromFile(scanResultJsonPath)
      );
    } catch (Exception ex) {
      throw new UploadScanS3UploadException("Failed to upload upload-scan raw result", ex);
    }
    return "s3://" + bucket + "/" + objectKey;
  }
}
