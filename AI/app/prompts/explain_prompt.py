from langchain_core.prompts import ChatPromptTemplate


_EXPLAIN_SYSTEM = (
    "You are a security analyst for SSAfer. "
    "Your audience is vibe-coders or beginner developers with no security background. "
    "Help them understand why a finding is dangerous. "
    "Write all natural-language fields in Korean, using simple words and short sentences. "
    "Never use Japanese, Chinese, Hanja, Thai, Spanish, Latin, or broken characters. "
    "Do not write long English sentences. "
    "Identifiers, filenames, rule IDs, evidence values, and tech terms may stay in their original form. "
    "Do not assert facts not present in the finding, secret values, or whether an attack succeeded. "
    "If the title indicates a mitigation is in place (e.g. 'DOCKER-USER 차단됨', '방화벽 차단됨'), reflect that the risk is already reduced and adjust the tone accordingly. Do not describe it as fully exposed. "
    "Do not include fix suggestions, code examples, commands, tables, or code blocks. "
    "Return only a JSON object containing explanation and impact."
)

EXPLAIN_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", _EXPLAIN_SYSTEM),
        (
            "human",
            (
                "Explain the security finding below.\n\n"
                "{finding_input}\n\n"
                "Respond ONLY with JSON in the format below. No markdown.\n"
                "{{\n"
                '  "explanation": {{\n'
                '    "summary": "vulnerability summary",\n'
                '    "whyRisky": "why it is risky",\n'
                '    "abuseScenario": "possible abuse scenario",\n'
                '    "expectedImpact": "expected impact",\n'
                '    "severityInterpretation": "severity interpretation"\n'
                "  }},\n"
                '  "impact": "easy analogy for complete beginners"\n'
                "}}\n\n"
                "Field guidelines:\n"
                "- explanation.summary: 1-2 sentences describing what this finding means\n"
                "- explanation.whyRisky: 2-3 sentences on why it is a security problem\n"
                "- explanation.abuseScenario: 2-3 sentences on plausible abuse flows based only on the finding\n"
                "- explanation.expectedImpact: 2-3 sentences on service, operational, and data impact\n"
                "- explanation.severityInterpretation: 1-2 sentences interpreting the given severity for prioritization\n"
                "- impact: 2-4 sentences using everyday analogies a complete beginner can understand\n\n"
                "Write all values in Korean. Do not output anything outside the JSON."
            ),
        ),
    ]
)


BATCH_EXPLAIN_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", _EXPLAIN_SYSTEM),
        (
            "human",
            (
                "Explain each of the security findings below.\n\n"
                "{finding_input}\n\n"
                "Respond ONLY with a JSON array in the format below. No markdown.\n"
                "[\n"
                "  {{\n"
                '    "findingId": "copy the Finding ID exactly",\n'
                '    "explanation": {{\n'
                '      "summary": "vulnerability summary",\n'
                '      "whyRisky": "why it is risky",\n'
                '      "abuseScenario": "possible abuse scenario",\n'
                '      "expectedImpact": "expected impact",\n'
                '      "severityInterpretation": "severity interpretation"\n'
                "    }},\n"
                '    "impact": "easy analogy for complete beginners"\n'
                "  }}\n"
                "]\n\n"
                "Create one object per finding. Use the Finding ID from the input as the findingId value.\n"
                "Field guidelines:\n"
                "- explanation.summary: 1-2 sentences describing what this finding means\n"
                "- explanation.whyRisky: 2-3 sentences on why it is a security problem\n"
                "- explanation.abuseScenario: 2-3 sentences on plausible abuse flows based only on the finding\n"
                "- explanation.expectedImpact: 2-3 sentences on service, operational, and data impact\n"
                "- explanation.severityInterpretation: 1-2 sentences interpreting the given severity for prioritization\n"
                "- impact: 2-4 sentences using everyday analogies a complete beginner can understand\n\n"
                "Write all values in Korean. Do not output anything outside the JSON."
            ),
        ),
    ]
)
