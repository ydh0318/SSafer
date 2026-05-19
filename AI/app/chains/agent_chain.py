import logging
from typing import Any

from langchain.agents import create_agent

from app.core.llm import get_llm
from app.prompts.agent_prompt import AGENT_SYSTEM_PROMPT
from app.tools.code_context_tool import analyze_code_context
from app.tools.cve_tool import search_cve
from app.tools.web_search_tool import search_web


logger = logging.getLogger(__name__)


DEFAULT_TOOLS = [search_cve, analyze_code_context, search_web]


def build_agent(tools: list[Any] | None = None) -> Any:
    """Tool-calling agent (LangChain 1.x create_agent → LangGraph CompiledStateGraph)를 생성한다.

    tools를 명시하지 않으면 DEFAULT_TOOLS(search_cve, analyze_code_context, search_web)를 사용한다.
    추후 finding 타입별 tool 세트 주입은 `tools` 인자로 override.

    호출자는 agent.invoke({"messages": [{"role": "user", "content": ...}]},
                          config={"recursion_limit": N})로 실행한다.
    """
    selected_tools = tools if tools is not None else DEFAULT_TOOLS
    return create_agent(
        model=get_llm(),
        tools=selected_tools,
        system_prompt=AGENT_SYSTEM_PROMPT,
    )
