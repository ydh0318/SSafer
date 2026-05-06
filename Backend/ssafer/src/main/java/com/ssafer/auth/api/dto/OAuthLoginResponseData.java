package com.ssafer.auth.api.dto;

import com.ssafer.auth.domain.enums.OAuthProvider;
import com.ssafer.user.domain.enums.AccountStatus;
import io.swagger.v3.oas.annotations.media.Schema;

public record OAuthLoginResponseData(
    @Schema(description = "OAuth 제공자", example = "GOOGLE")
    OAuthProvider provider,
    @Schema(description = "OAuth 제공자 사용자 식별자", example = "google-user-123")
    String providerUserId,
    @Schema(description = "OAuth 제공자에게서 받은 이메일", example = "user@ssafer.co.kr")
    String email,
    @Schema(description = "OAuth 제공자에게서 받은 표시 이름", example = "싸피맨")
    String displayName,
    @Schema(description = "기존 사용자 매칭 여부", example = "true")
    boolean existingUserMatched,
    @Schema(description = "매칭된 기존 사용자 ID", example = "1", nullable = true)
    Long existingUserId,
    @Schema(description = "매칭된 기존 사용자 계정 상태", example = "ACTIVE", nullable = true)
    AccountStatus existingUserAccountStatus
) {
}
