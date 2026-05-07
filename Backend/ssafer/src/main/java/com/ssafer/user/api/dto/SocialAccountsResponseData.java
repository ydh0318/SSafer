package com.ssafer.user.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

public record SocialAccountsResponseData(
    @Schema(description = "Social account connection statuses")
    List<SocialAccountResponseData> socials
) {
}
