import logging
import unittest

from app.services.llm_usage_service import log_llm_usage


class FakeResponse:
    content = "응답"
    usage_metadata = {
        "input_tokens": 23,
        "output_tokens": 8,
        "total_tokens": 31,
    }


class LLMUsageServiceTest(unittest.TestCase):
    def test_log_llm_usage_prefers_actual_token_metadata(self):
        logger = logging.getLogger("tests.llm_usage.actual")

        with self.assertLogs(logger, level="INFO") as logs:
            log_llm_usage(
                logger=logger,
                stage="EXPLAIN",
                finding_id="FND-0001",
                input_text="입력",
                response=FakeResponse(),
                attempt_count=1,
                max_output_tokens=900,
            )

        output = "\n".join(logs.output)
        self.assertIn("inputTokens=23", output)
        self.assertIn("outputTokens=8", output)
        self.assertIn("totalTokens=31", output)
        self.assertNotIn("estimatedInputTokens", output)

    def test_log_llm_usage_uses_estimate_without_metadata(self):
        logger = logging.getLogger("tests.llm_usage.estimated")

        with self.assertLogs(logger, level="INFO") as logs:
            log_llm_usage(
                logger=logger,
                stage="FIX",
                finding_id="FND-0002",
                input_text="입력",
                response="응답",
                attempt_count=1,
                max_output_tokens=800,
            )

        output = "\n".join(logs.output)
        self.assertIn("estimatedInputTokens=", output)
        self.assertIn("estimatedOutputTokens=", output)
        self.assertIn("usageSource=estimated", output)


if __name__ == "__main__":
    unittest.main()
