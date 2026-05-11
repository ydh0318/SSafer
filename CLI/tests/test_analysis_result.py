from __future__ import annotations

import json
from pathlib import Path

from ssafer.core import analysis_result


def test_download_analysis_result_for_scan_fetches_presigned_url_and_caches_file(monkeypatch, tmp_path: Path):
    requests = []

    class FakeResponse:
        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self.payload

    class FakeClient:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def get(self, url, headers=None):
            requests.append((url, headers, self.kwargs))
            if url.endswith("/api/v1/scans/123/analysis-result/download-url"):
                return FakeResponse(
                    {
                        "data": {
                            "analysisResultPath": "s3://bucket/analysis/123/analysis_result.json",
                            "downloadUrl": "https://s3.example.com/download",
                            "expiresInSeconds": 600,
                        }
                    }
                )
            return FakeResponse({"patches": [{"patchId": "P1"}]})

    monkeypatch.setattr(analysis_result.httpx, "Client", FakeClient)

    path = analysis_result.download_analysis_result_for_scan(
        tmp_path,
        scan_id=123,
        api_url="https://api.example.com",
        token="access-token",
    )

    assert path == tmp_path / ".ssafer" / "analysis" / "scans" / "123" / "analysis_result.json"
    assert json.loads(path.read_text(encoding="utf-8")) == {"patches": [{"patchId": "P1"}]}
    assert requests == [
        (
            "https://api.example.com/api/v1/scans/123/analysis-result/download-url",
            {"Authorization": "Bearer access-token"},
            {"timeout": 30.0, "follow_redirects": True},
        ),
        (
            "https://s3.example.com/download",
            None,
            {"timeout": 30.0, "follow_redirects": True},
        ),
    ]
