package com.ssafer.global.security;

/**
 * worker secret으로 인증된 내부 워커 호출 주체를 표현한다.
 */
public record WorkerPrincipal(String source) {

  public static WorkerPrincipal callbackWorker() {
    return new WorkerPrincipal("worker-callback");
  }
}
