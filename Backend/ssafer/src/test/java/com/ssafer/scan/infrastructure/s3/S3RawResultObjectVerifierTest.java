package com.ssafer.scan.infrastructure.s3;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;

class S3RawResultObjectVerifierTest {

  @Test
  void existsWhenHeadObjectSucceedsReturnsTrue() {
    S3Client s3Client = mock(S3Client.class);
    when(s3Client.headObject(any(HeadObjectRequest.class))).thenReturn(HeadObjectResponse.builder().build());

    S3RawResultObjectVerifier verifier = new S3RawResultObjectVerifier(s3Client);

    boolean exists = verifier.exists("s3://ssafer/raw/1001/scan_result.json");

    assertThat(exists).isTrue();
  }

  @Test
  void existsWhenNoSuchKeyReturnsFalse() {
    S3Client s3Client = mock(S3Client.class);
    doThrow(NoSuchKeyException.builder().build()).when(s3Client).headObject(any(HeadObjectRequest.class));

    S3RawResultObjectVerifier verifier = new S3RawResultObjectVerifier(s3Client);

    boolean exists = verifier.exists("s3://ssafer/raw/1001/scan_result.json");

    assertThat(exists).isFalse();
  }

  @Test
  void existsWhenS3Status404ReturnsFalse() {
    S3Client s3Client = mock(S3Client.class);
    doThrow(S3Exception.builder().statusCode(404).build()).when(s3Client).headObject(any(HeadObjectRequest.class));

    S3RawResultObjectVerifier verifier = new S3RawResultObjectVerifier(s3Client);

    boolean exists = verifier.exists("s3://ssafer/raw/1001/scan_result.json");

    assertThat(exists).isFalse();
  }

  @Test
  void existsWhenS3ErrorOccursThrowsInternalServerError() {
    S3Client s3Client = mock(S3Client.class);
    doThrow(S3Exception.builder().statusCode(403).build()).when(s3Client).headObject(any(HeadObjectRequest.class));

    S3RawResultObjectVerifier verifier = new S3RawResultObjectVerifier(s3Client);

    assertThatThrownBy(() -> verifier.exists("s3://ssafer/raw/1001/scan_result.json"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
  }

  @Test
  void existsWhenSdkClientErrorOccursThrowsInternalServerError() {
    S3Client s3Client = mock(S3Client.class);
    doThrow(SdkClientException.builder().message("timeout").build()).when(s3Client).headObject(any(HeadObjectRequest.class));

    S3RawResultObjectVerifier verifier = new S3RawResultObjectVerifier(s3Client);

    assertThatThrownBy(() -> verifier.exists("s3://ssafer/raw/1001/scan_result.json"))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
  }
}
