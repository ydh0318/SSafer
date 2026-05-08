from abc import ABC, abstractmethod
from typing import Any

import httpx
from langchain_ollama import ChatOllama

from app.core.config import (
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
    ANTHROPIC_TEMPERATURE,
    ANTHROPIC_TIMEOUT_SECONDS,
    LLM_PROVIDER,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_TEMPERATURE,
    OLLAMA_TIMEOUT_SECONDS,
)


class LLMConfigurationError(ValueError):
    pass


class LLMProvider(ABC):
    provider_name: str

    @abstractmethod
    def create_chat_model(self, response_format: str | None = None) -> Any:
        raise NotImplementedError

    @abstractmethod
    def get_model_name(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def is_available(self) -> bool:
        raise NotImplementedError

    def generate(self, prompt: str) -> str:
        response = self.create_chat_model().invoke(prompt)
        return getattr(response, "content", response)

    def analyze(self, prompt: str, response_format: str | None = None) -> str:
        response = self.create_chat_model(response_format=response_format).invoke(prompt)
        return getattr(response, "content", response)


class OllamaProvider(LLMProvider):
    provider_name = "ollama"

    def __init__(
        self,
        *,
        model: str = OLLAMA_MODEL,
        base_url: str = OLLAMA_BASE_URL,
        temperature: float = OLLAMA_TEMPERATURE,
        timeout_seconds: float = OLLAMA_TIMEOUT_SECONDS,
    ) -> None:
        self.model = model
        self.base_url = base_url
        self.temperature = temperature
        self.timeout_seconds = timeout_seconds

    def create_chat_model(self, response_format: str | None = None) -> ChatOllama:
        return ChatOllama(
            model=self.model,
            base_url=self.base_url,
            temperature=self.temperature,
            format=response_format,
            sync_client_kwargs={"timeout": self.timeout_seconds},
        )

    def get_model_name(self) -> str:
        return self.model

    def is_available(self) -> bool:
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=2.0)
            return response.is_success
        except httpx.HTTPError:
            return False


class AnthropicProvider(LLMProvider):
    provider_name = "anthropic"

    def __init__(
        self,
        *,
        api_key: str | None = ANTHROPIC_API_KEY,
        model: str = ANTHROPIC_MODEL,
        temperature: float = ANTHROPIC_TEMPERATURE,
        timeout_seconds: float = ANTHROPIC_TIMEOUT_SECONDS,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.temperature = temperature
        self.timeout_seconds = timeout_seconds

    def create_chat_model(self, response_format: str | None = None) -> Any:
        if not self.api_key:
            raise LLMConfigurationError("ANTHROPIC_API_KEY must be set.")

        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError as exc:
            raise LLMConfigurationError(
                "langchain-anthropic must be installed to use AnthropicProvider."
            ) from exc

        return ChatAnthropic(
            model=self.model,
            api_key=self.api_key,
            temperature=self.temperature,
            timeout=self.timeout_seconds,
        )

    def get_model_name(self) -> str:
        return self.model

    def is_available(self) -> bool:
        if not self.api_key:
            return False
        try:
            from langchain_anthropic import ChatAnthropic  # noqa: F401
        except ImportError:
            return False
        return True


def get_llm_provider(provider_name: str | None = None) -> LLMProvider:
    selected_provider = (provider_name or LLM_PROVIDER).strip().lower()

    if selected_provider == "ollama":
        return OllamaProvider()
    if selected_provider == "anthropic":
        return AnthropicProvider()

    raise LLMConfigurationError(
        f"Unsupported LLM_PROVIDER: {selected_provider}. "
        "Expected one of: ollama, anthropic."
    )
