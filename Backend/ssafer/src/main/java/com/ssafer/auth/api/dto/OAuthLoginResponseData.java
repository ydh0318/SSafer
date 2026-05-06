package com.ssafer.auth.api.dto;

import com.ssafer.auth.domain.enums.OAuthProvider;
import io.swagger.v3.oas.annotations.media.Schema;

public record OAuthLoginResponseData(
    @Schema(description = "OAuth 제공자", example = "GOOGLE")
    OAuthProvider provider,
    @Schema(description = "제공자 사용자 식별자", example = "google-user-123")
    String providerUserId,
    @Schema(description = "제공자에서 받은 이메일", example = "user@ssafer.co.kr")
    String email,
    @Schema(description = "제공자에서 받은 표시 이름", example = "싸피맨")
    String displayName
) {
}
