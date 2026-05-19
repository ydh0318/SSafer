from langchain_core.prompts import ChatPromptTemplate


_VERIFY_SYSTEM = (
    "You are SSAfer's security fix verifier. "
    "Decide whether the given fix actually addresses the given security finding. "
    "Return only a single JSON object with two fields: passed (boolean) and reason (Korean string). "
    "Do not use markdown code blocks. "
    "passed=true only when the fix is technically correct, on-topic for the finding, "
    "and the recommendedActions and codeGuidance are consistent with the finding's ruleId, title, and evidence. "
    "passed=false when: the fix talks about a different vulnerability than the finding, "
    "the recommendedActions are generic boilerplate unrelated to the finding, "
    "the codeGuidance contradicts the finding context, "
    "or any patch text is obviously broken or unsafe. "
    "When passed=false, the reason must clearly state which problem so the generator can regenerate. "
    "Write reason in Korean using short sentences. "
    "Never use Japanese, Chinese, Hanja, Thai, Spanish, Latin, or broken characters."
)


VERIFY_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", _VERIFY_SYSTEM),
        (
            "human",
            (
                "Verify the fix for the security finding below.\n\n"
                "=== Finding ===\n"
                "{finding_input}\n\n"
                "=== Generated Fix (JSON) ===\n"
                "{fix_input}\n\n"
                "Respond ONLY with JSON in the format below. No markdown.\n"
                "{{\n"
                '  "passed": true,\n'
                '  "reason": "간단한 Korean 사유 (passed=true여도 한 줄 요약)"\n'
                "}}\n\n"
                "Decision guideline:\n"
                "- passed=true: fix가 finding과 동일한 취약점/이슈를 다루고, recommendedActions가 구체적이며, codeGuidance가 finding의 file/evidence/ruleId에 부합.\n"
                "- passed=false: fix가 다른 CVE/취약점을 다루거나, 동작이 비현실적이거나, recommendedActions가 일반론에 그치거나, patch가 finding과 무관.\n"
                "Write reason in Korean. Do not output anything outside the JSON."
            ),
        ),
    ]
)
