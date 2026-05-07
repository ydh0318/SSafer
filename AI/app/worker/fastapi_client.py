from app.worker.http_client import JsonHttpClient
from app.worker.schemas import FastApiAnalyzeRequest, FastApiAnalyzeResponse


class FastApiClient:
    def __init__(self, http_client: JsonHttpClient):
        self.http_client = http_client

    def analyze(self, request: FastApiAnalyzeRequest) -> FastApiAnalyzeResponse:
        payload = request.model_dump(by_alias=True)
        response = self.http_client.post_json("/analyze", payload)
        return FastApiAnalyzeResponse.model_validate(response)
