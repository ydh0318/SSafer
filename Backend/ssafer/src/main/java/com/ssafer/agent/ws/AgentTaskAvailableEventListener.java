package com.ssafer.agent.ws;

import com.ssafer.agent.application.service.AgentTaskAvailableRequestedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
// task 저장 트랜잭션이 커밋된 뒤에만 WS 알림을 보내서 pull 시점에 task가 항상 보이도록 보장한다.
public class AgentTaskAvailableEventListener {

  private final AgentTaskAvailableNotificationService agentTaskAvailableNotificationService;

  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void onTaskAvailable(AgentTaskAvailableRequestedEvent event) {
    agentTaskAvailableNotificationService.notifyTaskAvailable(event);
  }
}
