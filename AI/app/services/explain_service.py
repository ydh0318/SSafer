from typing import Any

from app.chains.explain_chain import create_explain_chain
from app.services.input_service import format_finding_for_llm


def generate_finding_explanation(finding: dict[str, Any]) -> str:
    chain = create_explain_chain()
    finding_input = format_finding_for_llm(finding)
    return chain.invoke({"finding_input": finding_input})


def generate_finding_explanations(findings: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {
            "finding_id": finding["id"],
            "explanation": generate_finding_explanation(finding),
        }
        for finding in findings
    ]
