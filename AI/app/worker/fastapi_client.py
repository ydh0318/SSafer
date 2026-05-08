from pydantic import ValidationError

from app.worker.http_client import JsonHttpClient
from app.worker.http_client import JsonHttpClientError
from app.worker.schemas import FastApiAnalyzeRequest, FastApiAnalyzeResponse


class FastApiClient:
    def __init__(self, http_client: JsonHttpClient):
        self.http_client = http_client

    def analyze(self, request: FastApiAnalyzeRequest) -> FastApiAnalyzeResponse:
        payload = request.model_dump(by_alias=True)
        try:
            response = self.http_client.post_json("/analyze", payload)
        except JsonHttpClientError as exc:
            if exc.response_json is None:
                raise
            try:
                return FastApiAnalyzeResponse.model_validate(exc.response_json)
            except ValidationError:
                raise exc
        return FastApiAnalyzeResponse.model_validate(response)
