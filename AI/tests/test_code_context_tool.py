import unittest

from app.tools.code_context_tool import (
    analyze_code_context,
    reset_scan_result_context,
    set_scan_result_context,
)


def build_scan_result_with_artifact(content: str, target: str = "Dockerfile"):
    return {
        "artifacts": [
            {"target": target, "content": content, "hash": "sha256:abc", "type": "file"}
        ]
    }


SAMPLE_DOCKERFILE = "\n".join(
    [
        "FROM python:3.11-slim",       # line 1
        "WORKDIR /app",                # line 2
        "COPY requirements.txt ./",    # line 3
        "RUN pip install -r requirements.txt",  # line 4
        "COPY app ./app",              # line 5
        "USER root",                   # line 6  ← finding 위치
        "EXPOSE 8000",                 # line 7
        "CMD [\"uvicorn\", \"app.main:app\"]",  # line 8
    ]
)


class CodeContextToolTest(unittest.TestCase):
    def tearDown(self):
        try:
            reset_scan_result_context(self._token)
        except (AttributeError, LookupError, ValueError):
            pass

    def _set_context(self, scan_result):
        self._token = set_scan_result_context(scan_result)

    def test_no_context_returns_unavailable(self):
        result = analyze_code_context.invoke({"target": "Dockerfile", "line": 6})
        self.assertFalse(result["available"])
        self.assertEqual(result["target"], "Dockerfile")
        self.assertIn("no scan context", result["reason"])

    def test_target_not_in_artifacts(self):
        self._set_context(build_scan_result_with_artifact(SAMPLE_DOCKERFILE, target="Dockerfile"))
        result = analyze_code_context.invoke({"target": "Other", "line": 1})
        self.assertFalse(result["available"])
        self.assertEqual(result["target"], "Other")
        self.assertIn("not found", result["reason"])

    def test_centered_snippet_around_line(self):
        self._set_context(build_scan_result_with_artifact(SAMPLE_DOCKERFILE))
        result = analyze_code_context.invoke(
            {"target": "Dockerfile", "line": 6, "context_lines": 2}
        )
        self.assertTrue(result["available"])
        self.assertEqual(result["mode"], "centered")
        self.assertEqual(result["line_range"], [4, 8])
        self.assertIn("USER root", result["snippet"])
        self.assertIn("RUN pip install", result["snippet"])
        self.assertEqual(result["total_lines"], 8)

    def test_line_zero_returns_preview(self):
        self._set_context(build_scan_result_with_artifact(SAMPLE_DOCKERFILE))
        result = analyze_code_context.invoke({"target": "Dockerfile", "line": 0})
        self.assertTrue(result["available"])
        self.assertEqual(result["mode"], "preview")
        self.assertEqual(result["line_range"][0], 1)
        self.assertIn("FROM python", result["snippet"])

    def test_context_lines_clamped_to_max(self):
        long_content = "\n".join(f"line {i}" for i in range(1, 201))
        self._set_context(build_scan_result_with_artifact(long_content))
        result = analyze_code_context.invoke(
            {"target": "Dockerfile", "line": 100, "context_lines": 999}
        )
        self.assertTrue(result["available"])
        start, end = result["line_range"]
        self.assertEqual(end - start, 100)  # 50 위 + 50 아래

    def test_empty_artifact_returns_unavailable(self):
        self._set_context(build_scan_result_with_artifact("", target="Dockerfile"))
        result = analyze_code_context.invoke({"target": "Dockerfile", "line": 1})
        self.assertFalse(result["available"])
        self.assertIn("empty", result["reason"])


if __name__ == "__main__":
    unittest.main()
