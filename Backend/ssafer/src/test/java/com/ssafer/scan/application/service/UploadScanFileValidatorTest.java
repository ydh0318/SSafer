package com.ssafer.scan.application.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

class UploadScanFileValidatorTest {

  private final UploadScanFileValidator validator = new UploadScanFileValidator();

  @Test
  void validateAcceptsAllowedFilenamesWithinLimit() {
    List<MultipartFile> files = List.of(
        file(".env", "A"),
        file("Dockerfile", "B"),
        file("docker-compose.prod.yml", "C")
    );

    assertThatCode(() -> validator.validate(files)).doesNotThrowAnyException();
  }

  @Test
  void validateWhenFilesMissingThrowsInvalidParameter() {
    assertThatThrownBy(() -> validator.validate(null))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void validateWhenEmptyFileThrowsInvalidParameter() {
    assertThatThrownBy(() -> validator.validate(List.of(file(".env", ""))))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void validateWhenFileCountExceededThrowsFileCountExceeded() {
    List<MultipartFile> files = List.of(
        file(".env", "A"),
        file("Dockerfile", "B"),
        file("compose.yml", "C"),
        file("Containerfile", "D")
    );

    assertThatThrownBy(() -> validator.validate(files))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.FILE_COUNT_EXCEEDED);
  }

  @Test
  void validateWhenPayloadTooLargeThrowsPayloadTooLarge() {
    byte[] large = new byte[1_048_577];
    MockMultipartFile file = new MockMultipartFile("files", ".env", "text/plain", large);

    assertThatThrownBy(() -> validator.validate(List.of(file)))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.PAYLOAD_TOO_LARGE);
  }

  @Test
  void validateWhenPathTraversalNameThrowsInvalidParameter() {
    assertThatThrownBy(() -> validator.validate(List.of(file("../.env", "A"))))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_PARAMETER);
  }

  @Test
  void validateWhenUnsupportedFilenameThrowsUnsupportedFileType() {
    assertThatThrownBy(() -> validator.validate(List.of(file("dockerfile", "A"))))
        .isInstanceOf(BusinessException.class)
        .extracting(ex -> ((BusinessException) ex).getErrorCode())
        .isEqualTo(ErrorCode.UNSUPPORTED_FILE_TYPE);
  }

  private MultipartFile file(String name, String content) {
    return new MockMultipartFile("files", name, "text/plain", content.getBytes(StandardCharsets.UTF_8));
  }
}
