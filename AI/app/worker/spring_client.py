from app.worker.http_client import JsonHttpClient
from app.worker.schemas import AnalysisResultCallbackRequest


class SpringClient:
    def __init__(self, http_client: JsonHttpClient):
        self.http_client = http_client

    def send_analysis_result_callback(
        self,
        scan_id: int,
        request: AnalysisResultCallbackRequest,
    ) -> dict:
        return self.http_client.post_json(
            f"/api/v1/internal/scans/{scan_id}/analysis-results",
            request.model_dump(by_alias=True),
        )
