package com.ssafer.auth.api.dto;

import com.ssafer.auth.domain.enums.OAuthProvider;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record OAuthLoginRequest(
    @NotNull
    @Schema(description = "OAuth provider", example = "GOOGLE")
    OAuthProvider provider,
    @Schema(description = "OAuth authorization code", example = "4/0AQSTgQ...")
    String authorizationCode,
    @Schema(description = "OAuth redirect URI", example = "http://localhost:5173/oauth/google/callback")
    String redirectUri,
    @Schema(description = "Confirm rejoin for a withdrawn account", example = "false")
    Boolean confirmRejoin,
    @Schema(description = "Rejoin token issued when REJOIN_REQUIRED is returned")
    String rejoinToken
) {
}
