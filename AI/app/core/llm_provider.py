from abc import ABC, abstractmethod
from typing import Any

import httpx
from langchain_ollama import ChatOllama

from app.core.config import (
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
    ANTHROPIC_TEMPERATURE,
    ANTHROPIC_TIMEOUT_SECONDS,
    GMS_API_KEY,
    GMS_BASE_URL,
    GMS_FORCE_JSON_RESPONSE_FORMAT,
    GMS_MODEL,
    GMS_TEMPERATURE,
    GMS_TIMEOUT_SECONDS,
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
    def create_chat_model(
        self,
        response_format: str | None = None,
        max_tokens: int | None = None,
    ) -> Any:
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

    def create_chat_model(
        self,
        response_format: str | None = None,
        max_tokens: int | None = None,
    ) -> ChatOllama:
        model_kwargs: dict[str, Any] = {
            "model": self.model,
            "base_url": self.base_url,
            "temperature": self.temperature,
            "format": response_format,
            "sync_client_kwargs": {"timeout": self.timeout_seconds},
        }
        if max_tokens is not None:
            model_kwargs["num_predict"] = max_tokens
        return ChatOllama(**model_kwargs)

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

    def create_chat_model(
        self,
        response_format: str | None = None,
        max_tokens: int | None = None,
    ) -> Any:
        if not self.api_key:
            raise LLMConfigurationError("ANTHROPIC_API_KEY must be set.")

        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError as exc:
            raise LLMConfigurationError(
                "langchain-anthropic must be installed to use AnthropicProvider."
            ) from exc

        model_kwargs: dict[str, Any] = {
            "model": self.model,
            "api_key": self.api_key,
            "temperature": self.temperature,
            "timeout": self.timeout_seconds,
        }
        if max_tokens is not None:
            model_kwargs["max_tokens"] = max_tokens
        return ChatAnthropic(**model_kwargs)

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


class GmsProvider(LLMProvider):
    provider_name = "gms"

    def __init__(
        self,
        *,
        api_key: str | None = GMS_API_KEY,
        model: str = GMS_MODEL,
        base_url: str = GMS_BASE_URL,
        temperature: float = GMS_TEMPERATURE,
        timeout_seconds: float = GMS_TIMEOUT_SECONDS,
        force_json_response_format: bool = GMS_FORCE_JSON_RESPONSE_FORMAT,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.temperature = temperature
        self.timeout_seconds = timeout_seconds
        self.force_json_response_format = force_json_response_format

    def create_chat_model(
        self,
        response_format: str | None = None,
        max_tokens: int | None = None,
    ) -> Any:
        if self._uses_anthropic_messages_api():
            return self._create_anthropic_chat_model(max_tokens=max_tokens)
        return self._create_openai_compatible_chat_model(
            response_format=response_format,
            max_tokens=max_tokens,
        )

    def _uses_anthropic_messages_api(self) -> bool:
        return self.model.startswith("claude-")

    def _create_anthropic_chat_model(self, max_tokens: int | None = None) -> Any:
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError as exc:
            raise LLMConfigurationError(
                "langchain-anthropic must be installed to use GMS Claude models."
            ) from exc

        api_key = self._get_api_key()
        model_kwargs: dict[str, Any] = {
            "model": self.model,
            "api_key": api_key,
            "base_url": self.base_url,
            "temperature": self.temperature,
            "timeout": self.timeout_seconds,
        }
        if max_tokens is not None:
            model_kwargs["max_tokens"] = max_tokens
        return ChatAnthropic(**model_kwargs)

    def _create_openai_compatible_chat_model(
        self,
        response_format: str | None = None,
        max_tokens: int | None = None,
    ) -> Any:
        try:
            from langchain.chat_models import init_chat_model
        except ImportError as exc:
            raise LLMConfigurationError(
                "langchain must be installed to use GmsProvider."
            ) from exc

        import os

        api_key = self._get_api_key()
        os.environ["OPENAI_API_KEY"] = api_key
        os.environ["OPENAI_API_BASE"] = self.base_url
        os.environ["OPENAI_BASE_URL"] = self.base_url

        model_kwargs: dict[str, Any] = {
            "temperature": self.temperature,
            "timeout": self.timeout_seconds,
        }
        if response_format == "json" and self.force_json_response_format:
            model_kwargs["response_format"] = {"type": "json_object"}
        if max_tokens is not None:
            model_kwargs["max_tokens"] = max_tokens

        return init_chat_model(
            self.model,
            model_provider="openai",
            **model_kwargs,
        )

    def _get_api_key(self) -> str:
        import os

        api_key = self.api_key or os.getenv("GMS_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise LLMConfigurationError("GMS_API_KEY or OPENAI_API_KEY must be set.")
        return api_key

    def get_model_name(self) -> str:
        return self.model

    def is_available(self) -> bool:
        import os

        return bool(
            self.api_key
            or os.getenv("GMS_API_KEY")
            or os.getenv("OPENAI_API_KEY")
        )


def create_llm_provider(
    provider_name: str,
    *,
    model: str | None = None,
    api_key: str | None = None,
) -> LLMProvider:
    selected_provider = provider_name.strip().lower()

    if selected_provider == "ollama":
        return OllamaProvider(model=model or OLLAMA_MODEL)
    if selected_provider == "anthropic":
        return AnthropicProvider(api_key=api_key, model=model or ANTHROPIC_MODEL)
    if selected_provider == "gms":
        return GmsProvider(api_key=api_key, model=model or GMS_MODEL)

    raise LLMConfigurationError(
        f"Unsupported LLM provider: {selected_provider}. "
        "Expected one of: ollama, anthropic, gms."
    )


def get_llm_provider(provider_name: str | None = None) -> LLMProvider:
    selected_provider = (provider_name or LLM_PROVIDER).strip().lower()

    return create_llm_provider(selected_provider)
