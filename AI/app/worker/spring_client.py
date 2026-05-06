from app.worker.http_client import JsonHttpClient
from app.worker.schemas import AgentTaskResultRequest, AgentTaskStatusUpdateRequest


class SpringClient:
    def __init__(self, http_client: JsonHttpClient):
        self.http_client = http_client

    def update_task_status(
        self,
        task_id: int,
        request: AgentTaskStatusUpdateRequest,
    ) -> dict:
        return self.http_client.patch_json(
            f"/api/v1/internal/agent-tasks/{task_id}/status",
            request.model_dump(by_alias=True),
        )

    def send_task_result(
        self,
        task_id: int,
        request: AgentTaskResultRequest,
    ) -> dict:
        return self.http_client.post_json(
            f"/api/v1/internal/agent-tasks/{task_id}/result",
            request.model_dump(by_alias=True),
        )
