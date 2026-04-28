from typing import Any

from app.chains.fix_chain import create_fix_chain
from app.services.explain_service import contains_disallowed_script
from app.services.input_service import format_finding_for_llm


MAX_FIX_RETRIES = 2


def generate_finding_fix(finding: dict[str, Any]) -> str:
    chain = create_fix_chain()
    finding_input = format_finding_for_llm(finding)

    for attempt in range(MAX_FIX_RETRIES + 1):
        prompt_input = finding_input
        if attempt > 0:
            prompt_input = "\n".join(
                [
                    finding_input,
                    "",
                    "중요:",
                    "이전 답변이 요구 조건을 지키지 못했습니다.",
                    "응답은 반드시 유효한 JSON 객체 하나만 반환하세요.",
                    "마크다운 코드 블록, 설명 문장, 주석은 포함하지 마세요.",
                    "답변은 한국어 또는 영어로만 작성하세요.",
                    "일본어, 중국어, 한자, 깨진 문자를 절대 사용하지 마세요.",
                    "파일명, 규칙 ID, 탐지 ID, 근거 값만 원문 그대로 유지할 수 있습니다.",
                ]
            )

        fix = chain.invoke({"finding_input": prompt_input})
        if not contains_disallowed_script(fix):
            return fix

    raise ValueError(
        "Fix Chain output contains Japanese, Chinese, Hanja, or broken characters."
    )


def generate_finding_fixes(findings: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {
            "finding_id": finding["id"],
            "fix": generate_finding_fix(finding),
        }
        for finding in findings
    ]
