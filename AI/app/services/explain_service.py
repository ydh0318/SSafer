import re
from typing import Any

from app.chains.explain_chain import create_explain_chain
from app.services.input_service import format_finding_for_llm


DISALLOWED_SCRIPT_PATTERN = re.compile(
    r"[\u0e00-\u0e7f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]"
)
MAX_EXPLAIN_RETRIES = 4


def contains_disallowed_script(text: str) -> bool:
    return bool(DISALLOWED_SCRIPT_PATTERN.search(text))


def get_disallowed_scripts(text: str) -> str:
    return "".join(sorted(set(DISALLOWED_SCRIPT_PATTERN.findall(text))))


def generate_finding_explanation(finding: dict[str, Any]) -> str:
    chain = create_explain_chain()
    finding_input = format_finding_for_llm(finding)
    last_disallowed_scripts = ""

    for attempt in range(MAX_EXPLAIN_RETRIES + 1):
        prompt_input = finding_input
        if attempt > 0:
            retry_instructions = [
                finding_input,
                "",
                "중요:",
                "이전 답변에 허용되지 않는 문자가 포함되었습니다.",
                f"금지 문자 예시: {last_disallowed_scripts}",
                "자연어 설명은 한국어로만 작성하세요.",
                "일본어, 중국어, 한자, 태국어, 스페인어, 라틴어, 깨진 문자를 절대 사용하지 마세요.",
                "일반 영어 단어를 섞지 말고 쉬운 한국어로 바꾸세요.",
                "파일명, 규칙 ID, 탐지 ID, 근거 값만 원문 그대로 유지할 수 있습니다.",
                "모든 문장을 작성한 뒤, 허용되지 않는 문자가 있으면 답변 전체를 다시 작성하세요.",
                "확신이 없으면 더 짧고 단순한 한국어 문장으로 답하세요.",
            ]

            if attempt == MAX_EXPLAIN_RETRIES:
                retry_instructions.extend(
                    [
                        "",
                        "마지막 재시도 형식:",
                        "아래 5개 섹션을 각각 한 문장으로만 작성하세요.",
                        "문장을 짧게 쓰고, 괄호와 영어 설명을 쓰지 마세요.",
                        "1. 취약점 요약",
                        "2. 위험한 이유",
                        "3. 악용 가능 시나리오",
                        "4. 예상 영향",
                        "5. 심각도 해석",
                    ]
                )

            prompt_input = "\n".join(retry_instructions)

        explanation = chain.invoke({"finding_input": prompt_input})
        last_disallowed_scripts = get_disallowed_scripts(explanation)
        if not last_disallowed_scripts:
            return explanation

    raise ValueError(
        "Explain Chain output contains disallowed foreign or broken characters: "
        f"{last_disallowed_scripts}"
    )


def generate_finding_explanations(findings: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {
            "finding_id": finding["id"],
            "explanation": generate_finding_explanation(finding),
        }
        for finding in findings
    ]
