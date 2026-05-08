import unittest
from unittest.mock import patch

import httpx

from app.core.llm import (
    LLMCallError,
    LLMTimeoutError,
    get_ollama_llm,
    invoke_llm_with_retry,
)
from app.core.llm_provider import (
    AnthropicProvider,
    LLMConfigurationError,
    OllamaProvider,
    get_llm_provider,
)


class FakeRunnable:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    def invoke(self, input_data):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class LLMRetryTest(unittest.TestCase):
    def test_invoke_llm_with_retry_returns_after_transient_failure(self):
        runnable = FakeRunnable([RuntimeError("temporary"), "ok"])

        result = invoke_llm_with_retry(
            runnable,
            {"finding_input": "test"},
            max_retries=2,
            backoff_seconds=0,
        )

        self.assertEqual(result, "ok")
        self.assertEqual(runnable.calls, 2)

    def test_invoke_llm_with_retry_raises_timeout_after_retries(self):
        runnable = FakeRunnable(
            [
                httpx.TimeoutException("timeout 1"),
                httpx.TimeoutException("timeout 2"),
            ]
        )

        with self.assertRaises(LLMTimeoutError) as context:
            invoke_llm_with_retry(
                runnable,
                "prompt",
                max_retries=1,
                backoff_seconds=0,
            )

        self.assertIn("after 2 attempt(s)", str(context.exception))
        self.assertEqual(runnable.calls, 2)

    def test_invoke_llm_with_retry_raises_call_error_after_retries(self):
        runnable = FakeRunnable([RuntimeError("down"), RuntimeError("still down")])

        with self.assertRaises(LLMCallError):
            invoke_llm_with_retry(
                runnable,
                "prompt",
                max_retries=1,
                backoff_seconds=0,
            )

        self.assertEqual(runnable.calls, 2)

    @patch("app.core.llm.OLLAMA_TIMEOUT_SECONDS", 7)
    def test_get_ollama_llm_configures_sync_timeout(self):
        llm = get_ollama_llm()

        self.assertEqual(llm.sync_client_kwargs["timeout"], 7)

    def test_get_llm_provider_returns_ollama_provider(self):
        provider = get_llm_provider("ollama")

        self.assertIsInstance(provider, OllamaProvider)

    def test_get_llm_provider_returns_anthropic_provider(self):
        provider = get_llm_provider("anthropic")

        self.assertIsInstance(provider, AnthropicProvider)

    def test_get_llm_provider_rejects_unknown_provider(self):
        with self.assertRaises(LLMConfigurationError):
            get_llm_provider("unknown")


if __name__ == "__main__":
    unittest.main()
