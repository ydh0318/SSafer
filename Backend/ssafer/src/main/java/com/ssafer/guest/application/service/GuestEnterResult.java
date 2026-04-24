package com.ssafer.guest.application.service;

import java.time.Instant;

public record GuestEnterResult(
    String guestAccessToken,
    Instant expiresAt
) {
}
