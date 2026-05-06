import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class JsonHttpClientError(RuntimeError):
    pass


class JsonHttpClient:
    def __init__(
        self,
        *,
        base_url: str,
        timeout_seconds: int,
        default_headers: dict[str, str] | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.default_headers = default_headers or {}

    def post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._send_json("POST", path, payload)

    def patch_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._send_json("PATCH", path, payload)

    def _send_json(
        self,
        method: str,
        path: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            **self.default_headers,
        }
        request = Request(url, data=body, headers=headers, method=method)

        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                response_body = response.read()
        except HTTPError as exc:
            response_body = exc.read().decode("utf-8", errors="replace")
            raise JsonHttpClientError(
                f"{method} {url} failed with HTTP {exc.code}: {response_body}"
            ) from exc
        except URLError as exc:
            raise JsonHttpClientError(f"{method} {url} failed: {exc.reason}") from exc

        if not response_body:
            return {}

        try:
            decoded = json.loads(response_body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise JsonHttpClientError(f"{method} {url} returned invalid JSON.") from exc

        if not isinstance(decoded, dict):
            raise JsonHttpClientError(f"{method} {url} response must be a JSON object.")

        return decoded
