package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record SocialAccountConnectRequest(
    @NotBlank
    @Schema(description = "OAuth authorization code", example = "4/0AQSTgQ...")
    String authorizationCode,
    @NotBlank
    @Schema(description = "OAuth redirect URI", example = "http://localhost:5173/oauth/google/callback")
    String redirectUri
) {
}
