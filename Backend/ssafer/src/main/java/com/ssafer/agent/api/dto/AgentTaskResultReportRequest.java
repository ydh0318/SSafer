package com.ssafer.agent.api.dto;

import com.ssafer.agent.domain.enums.AgentTaskStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AgentTaskResultReportRequest(
    @NotNull
    AgentTaskStatus taskStatus,
    @Size(max = 1000)
    String resultMessage,
    List<@Valid PatchResultItem> patchResults
) {

  public record PatchResultItem(
      @Size(max = 100)
      String patchId,
      @Size(max = 500)
      String filePath,
      @NotNull
      PatchResultStatus status,
      @Size(max = 1000)
      String message,
      @Size(max = 500)
      String backupPath
  ) {
  }

  public enum PatchResultStatus {
    SUCCESS,
    FAILED
  }
}
