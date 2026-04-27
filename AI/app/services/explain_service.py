import re
from typing import Any

from app.chains.explain_chain import create_explain_chain
from app.services.input_service import format_finding_for_llm


DISALLOWED_SCRIPT_PATTERN = re.compile(
    r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]"
)
MAX_EXPLAIN_RETRIES = 2


def contains_disallowed_script(text: str) -> bool:
    return bool(DISALLOWED_SCRIPT_PATTERN.search(text))


def generate_finding_explanation(finding: dict[str, Any]) -> str:
    chain = create_explain_chain()
    finding_input = format_finding_for_llm(finding)

    for attempt in range(MAX_EXPLAIN_RETRIES + 1):
        prompt_input = finding_input
        if attempt > 0:
            prompt_input = "\n".join(
                [
                    finding_input,
                    "",
                    "중요:",
                    "이전 답변에 허용되지 않는 문자가 포함되었습니다.",
                    "답변은 한국어 또는 영어로만 작성하세요.",
                    "일본어, 중국어, 한자, 깨진 문자를 절대 사용하지 마세요.",
                    "한국어 답변에서는 일반 영어 단어를 쉬운 한국어로 바꾸세요.",
                    "파일명, 규칙 ID, 탐지 ID, 근거 값만 원문 그대로 유지할 수 있습니다.",
                ]
            )

        explanation = chain.invoke({"finding_input": prompt_input})
        if not contains_disallowed_script(explanation):
            return explanation

    raise ValueError(
        "Explain Chain output contains Japanese, Chinese, Hanja, or broken characters."
    )


def generate_finding_explanations(findings: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {
            "finding_id": finding["id"],
            "explanation": generate_finding_explanation(finding),
        }
        for finding in findings
    ]
