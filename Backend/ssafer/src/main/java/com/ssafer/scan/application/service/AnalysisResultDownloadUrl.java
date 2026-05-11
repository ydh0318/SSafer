package com.ssafer.scan.application.service;

public record AnalysisResultDownloadUrl(
    String downloadUrl,
    long expiresInSeconds
) {
}
