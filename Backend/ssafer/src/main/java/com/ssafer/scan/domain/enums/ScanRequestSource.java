package com.ssafer.scan.domain.enums;

// 스캔 시작 요청의 호출 주체를 표현한다.
// CLI/AGENT 모두 허용하며, 미지정 시 기본값은 CLI다.
public enum ScanRequestSource {
  CLI,
  AGENT
}
