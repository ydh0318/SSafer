package com.ssafer.scan.domain.enums;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ScanStatusTest {

  @Test
  void canTransitionToFollowsScanLifecycle() {
    assertThat(ScanStatus.REQUESTED.canTransitionTo(ScanStatus.QUEUED)).isTrue();
    assertThat(ScanStatus.REQUESTED.canTransitionTo(ScanStatus.RAW_UPLOADED)).isTrue();
    assertThat(ScanStatus.RAW_UPLOADED.canTransitionTo(ScanStatus.QUEUED)).isTrue();
    assertThat(ScanStatus.QUEUED.canTransitionTo(ScanStatus.RUNNING)).isTrue();
    assertThat(ScanStatus.RUNNING.canTransitionTo(ScanStatus.RAW_UPLOADED)).isTrue();
    assertThat(ScanStatus.RUNNING.canTransitionTo(ScanStatus.DONE)).isTrue();

    assertThat(ScanStatus.QUEUED.canTransitionTo(ScanStatus.DONE)).isFalse();
    assertThat(ScanStatus.DONE.canTransitionTo(ScanStatus.RUNNING)).isFalse();
    assertThat(ScanStatus.CANCELED.canTransitionTo(ScanStatus.QUEUED)).isFalse();
  }

  @Test
  void terminalFlagIsConsistent() {
    assertThat(ScanStatus.DONE.isTerminal()).isTrue();
    assertThat(ScanStatus.FAILED.isTerminal()).isTrue();
    assertThat(ScanStatus.CANCELED.isTerminal()).isTrue();
    assertThat(ScanStatus.QUEUED.isTerminal()).isFalse();
  }
}
