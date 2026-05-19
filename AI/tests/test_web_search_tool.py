import unittest
from unittest.mock import Mock, patch

import httpx

from app.tools import web_search_tool
from app.tools.web_search_tool import search_web


SERP_OK_RESPONSE = {
    "organicResults": [
        {
            "title": "Dockerfile best practices",
            "link": "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/",
            "snippet": "Run as a non-root user...",
        },
        {
            "title": "Hardening Dockerfile",
            "link": "https://example.com/hardening",
            "snippet": "Use USER directive",
        },
        {
            "title": "no link entry",
            "snippet": "should be skipped",
        },
        {
            "title": "Extra",
            "link": "https://example.com/extra",
            "snippet": "x" * 500,  # 길이 잘리는지 확인
        },
    ]
}


def make_mock_client(*, json_data=None, raise_exc: Exception | None = None):
    response = Mock()
    response.json.return_value = json_data or {}
    response.raise_for_status = Mock()

    client = Mock()
    if raise_exc is not None:
        client.post.side_effect = raise_exc
    else:
        client.post.return_value = response

    cm = Mock()
    cm.__enter__ = Mock(return_value=client)
    cm.__exit__ = Mock(return_value=False)
    return cm, client


class WebSearchToolTest(unittest.TestCase):
    def test_disabled_returns_empty(self):
        with patch.object(web_search_tool, "HASDATA_ENABLED", False):
            result = search_web.invoke({"query": "anything"})
        self.assertEqual(result, [])

    def test_missing_api_key_returns_empty(self):
        with patch.object(web_search_tool, "HASDATA_ENABLED", True), patch.object(
            web_search_tool, "HASDATA_API_KEY", ""
        ):
            result = search_web.invoke({"query": "anything"})
        self.assertEqual(result, [])

    def test_extracts_results_and_skips_entries_without_link(self):
        cm, _ = make_mock_client(json_data=SERP_OK_RESPONSE)
        with patch.object(web_search_tool, "HASDATA_ENABLED", True), patch.object(
            web_search_tool, "HASDATA_API_KEY", "key"
        ), patch.object(web_search_tool, "HASDATA_MAX_RESULTS", 5), patch.object(
            web_search_tool.httpx, "Client", return_value=cm
        ):
            result = search_web.invoke({"query": "dockerfile non-root", "max_results": 3})

        # "no link entry" skip 되어 3개만 (max_results=3)
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["title"], "Dockerfile best practices")
        self.assertTrue(result[0]["url"].startswith("https://docs.docker.com"))
        # 마지막 항목의 snippet은 잘렸어야 함
        self.assertLessEqual(len(result[2]["snippet"]), 300)

    def test_request_error_returns_empty(self):
        cm, _ = make_mock_client(raise_exc=httpx.ConnectError("fail"))
        with patch.object(web_search_tool, "HASDATA_ENABLED", True), patch.object(
            web_search_tool, "HASDATA_API_KEY", "key"
        ), patch.object(web_search_tool.httpx, "Client", return_value=cm):
            result = search_web.invoke({"query": "x"})
        self.assertEqual(result, [])

    def test_max_results_clamped_to_cap(self):
        cm, client = make_mock_client(json_data=SERP_OK_RESPONSE)
        with patch.object(web_search_tool, "HASDATA_ENABLED", True), patch.object(
            web_search_tool, "HASDATA_API_KEY", "key"
        ), patch.object(web_search_tool, "HASDATA_MAX_RESULTS", 5), patch.object(
            web_search_tool.httpx, "Client", return_value=cm
        ):
            search_web.invoke({"query": "x", "max_results": 100})
        payload = client.post.call_args.kwargs.get("json") or {}
        # cap = min(100, 5, HASDATA_MAX_RESULTS=5) = 5
        self.assertEqual(payload.get("num"), 5)


if __name__ == "__main__":
    unittest.main()
