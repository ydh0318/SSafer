import unittest
from unittest.mock import Mock, patch

import httpx

from app.tools import cve_tool
from app.tools.cve_tool import clear_cve_cache, search_cve


NVD_OK_RESPONSE = {
    "vulnerabilities": [
        {
            "cve": {
                "id": "CVE-2024-21626",
                "published": "2024-01-31T00:00:00Z",
                "lastModified": "2024-02-02T00:00:00Z",
                "descriptions": [
                    {"lang": "en", "value": "runc has a file descriptor leak that allows container breakout."},
                    {"lang": "ja", "value": "..."},
                ],
                "metrics": {
                    "cvssMetricV31": [
                        {
                            "cvssData": {
                                "baseScore": 8.6,
                                "baseSeverity": "HIGH",
                            }
                        }
                    ]
                },
                "references": [
                    {"url": "https://github.com/opencontainers/runc/security", "tags": ["Patch"]},
                    {"url": "https://example.com/exploit", "tags": ["Exploit"]},
                    {"url": "https://example.com/blog", "tags": []},
                ],
            }
        }
    ]
}


def make_mock_client(*, status_code: int = 200, json_data=None, raise_exc: Exception | None = None):
    """httpx.Client context manager mock."""
    response = Mock()
    response.status_code = status_code
    response.json.return_value = json_data or {}
    response.raise_for_status = Mock()
    if status_code >= 400:
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "err", request=Mock(), response=response
        )

    client = Mock()
    if raise_exc is not None:
        client.get.side_effect = raise_exc
    else:
        client.get.return_value = response

    cm = Mock()
    cm.__enter__ = Mock(return_value=client)
    cm.__exit__ = Mock(return_value=False)
    return cm, client


class CveToolTest(unittest.TestCase):
    def setUp(self):
        clear_cve_cache()

    def test_invalid_cve_id_returns_error(self):
        result = search_cve.invoke({"cve_id": "not-a-cve"})
        self.assertFalse(result["available"])
        self.assertIn("invalid CVE id format", result["error"])

    def test_normalizes_lowercase_id(self):
        cm, client = make_mock_client(json_data=NVD_OK_RESPONSE)
        with patch.object(cve_tool.httpx, "Client", return_value=cm):
            result = search_cve.invoke({"cve_id": "cve-2024-21626"})
        self.assertTrue(result["available"])
        self.assertEqual(result["cve_id"], "CVE-2024-21626")
        client.get.assert_called_once()
        called_params = client.get.call_args.kwargs.get("params") or {}
        self.assertEqual(called_params.get("cveId"), "CVE-2024-21626")

    def test_extracts_cvss_and_description(self):
        cm, _ = make_mock_client(json_data=NVD_OK_RESPONSE)
        with patch.object(cve_tool.httpx, "Client", return_value=cm):
            result = search_cve.invoke({"cve_id": "CVE-2024-21626"})
        self.assertEqual(result["cvss_score"], 8.6)
        self.assertEqual(result["severity"], "HIGH")
        self.assertIn("container breakout", result["description"])
        self.assertEqual(len(result["references"]), 3)
        self.assertEqual(result["references"][0]["url"], "https://github.com/opencontainers/runc/security")

    def test_cve_not_found(self):
        cm, _ = make_mock_client(json_data={"vulnerabilities": []})
        with patch.object(cve_tool.httpx, "Client", return_value=cm):
            result = search_cve.invoke({"cve_id": "CVE-2099-9999"})
        self.assertFalse(result["available"])
        self.assertIn("not found", result["error"])

    def test_http_error_returns_error_payload(self):
        cm, _ = make_mock_client(raise_exc=httpx.ConnectError("dns fail"))
        with patch.object(cve_tool.httpx, "Client", return_value=cm):
            result = search_cve.invoke({"cve_id": "CVE-2024-21626"})
        self.assertFalse(result["available"])
        self.assertIn("dns fail", result["error"])

    def test_cache_hit_skips_second_api_call(self):
        cm, client = make_mock_client(json_data=NVD_OK_RESPONSE)
        with patch.object(cve_tool.httpx, "Client", return_value=cm):
            r1 = search_cve.invoke({"cve_id": "CVE-2024-21626"})
            r2 = search_cve.invoke({"cve_id": "CVE-2024-21626"})
        self.assertEqual(r1, r2)
        # 같은 CVE 두 번 호출했어도 HTTP는 한 번
        self.assertEqual(client.get.call_count, 1)

    def test_authorization_header_sent_when_key_present(self):
        cm, client = make_mock_client(json_data=NVD_OK_RESPONSE)
        with patch.object(cve_tool, "NVD_API_KEY", "test-key-123"), patch.object(
            cve_tool.httpx, "Client", return_value=cm
        ):
            search_cve.invoke({"cve_id": "CVE-2024-99999"})
        headers = client.get.call_args.kwargs.get("headers") or {}
        self.assertEqual(headers.get("apiKey"), "test-key-123")


if __name__ == "__main__":
    unittest.main()
