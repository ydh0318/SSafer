from langchain_core.prompts import ChatPromptTemplate


EXPLAIN_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are a security analyst. "
                "Explain the security finding clearly and accurately for developers. "
                "Focus on what the issue means, why it is risky, how it could be abused, "
                "and what impact it may have. "
                "Do not provide detailed remediation steps; remediation will be handled separately. "
                "Write the answer in Korean."
            ),
        ),
        (
            "human",
            (
                "Analyze the following security finding.\n\n"
                "{finding_input}\n\n"
                "Return the explanation with these sections:\n"
                "1. 취약점 요약\n"
                "2. 위험한 이유\n"
                "3. 악용 가능 시나리오\n"
                "4. 예상 영향\n"
                "5. 심각도 해석"
            ),
        ),
    ]
)
