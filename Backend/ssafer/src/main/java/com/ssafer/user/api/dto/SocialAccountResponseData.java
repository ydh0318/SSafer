package com.ssafer.user.api.dto;

import com.ssafer.auth.domain.enums.OAuthProvider;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

public record SocialAccountResponseData(
    @Schema(description = "OAuth provider", example = "GOOGLE")
    OAuthProvider provider,
    @Schema(description = "Whether the provider is connected", example = "true")
    boolean connected,
    @Schema(description = "Linked social email", example = "user@ssafer.co.kr")
    String email,
    @Schema(description = "Social account linked at", example = "2026-05-07T09:00:00Z")
    Instant connectedAt
) {
}
