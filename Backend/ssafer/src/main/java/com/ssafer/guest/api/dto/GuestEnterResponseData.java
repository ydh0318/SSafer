package com.ssafer.guest.api.dto;

public record GuestEnterResponseData(
    String guestAccessToken,
    String expiresAt
) {
}
