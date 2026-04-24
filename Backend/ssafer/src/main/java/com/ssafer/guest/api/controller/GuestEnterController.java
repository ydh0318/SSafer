package com.ssafer.guest.api.controller;

import com.ssafer.global.api.ApiResponse;
import com.ssafer.guest.api.dto.GuestEnterRequest;
import com.ssafer.guest.api.dto.GuestEnterResponseData;
import com.ssafer.guest.application.service.GuestEnterCommand;
import com.ssafer.guest.application.service.GuestEnterResult;
import com.ssafer.guest.application.service.GuestEnterUseCase;
import java.time.format.DateTimeFormatter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/guests")
public class GuestEnterController {

  private static final String SUCCESS_MESSAGE = "게스트 세션 발급 성공";

  private final GuestEnterUseCase guestEnterUseCase;

  public GuestEnterController(GuestEnterUseCase guestEnterUseCase) {
    this.guestEnterUseCase = guestEnterUseCase;
  }

  @PostMapping("/enter")
  public ResponseEntity<ApiResponse<GuestEnterResponseData>> enter(
      @RequestBody(required = false) GuestEnterRequest request
  ) {
    // 게스트 진입은 요청 바디가 비어 있어도 허용하며, 이 경우 deviceId는 null로 전달한다.
    String deviceId = request != null ? request.deviceId() : null;
    GuestEnterResult result = guestEnterUseCase.enter(new GuestEnterCommand(deviceId));
    GuestEnterResponseData data = new GuestEnterResponseData(
        result.guestAccessToken(),
        DateTimeFormatter.ISO_INSTANT.format(result.expiresAt())
    );
    return ResponseEntity.ok(ApiResponse.success(SUCCESS_MESSAGE, data));
  }
}
