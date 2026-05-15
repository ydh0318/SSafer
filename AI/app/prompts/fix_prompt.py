from langchain_core.prompts import ChatPromptTemplate


_FIX_SYSTEM = (
    "You are SSAfer's security fix suggestion generator. "
    "Return only a single JSON object; do not use markdown code blocks. "
    "Always include: summary, priority, recommendedActions, codeGuidance, verification, cautions. "
    "priority must be exactly one of: critical, high, medium, low. Do not use urgent, severe, or other values. "
    "recommendedActions is a string array with 2-5 items. "
    "cautions is a string array with 0-3 items; use an empty array [] if nothing comes to mind. "
    "Write all user-facing natural-language fields in Korean. "
    "Filenames, rule IDs, finding IDs, tech terms, and code snippets may stay in their original form. "
    "Never use Japanese, Chinese, Hanja, Thai, Spanish, Latin, or broken characters. "
    "If source is server-audit or Scan Type is SERVER_AUDIT, do not generate patches; focus on operational guidance and verification commands. "
    "Include patches only when finding.patchContext provides enough context for a safe CLI patch.\n\n"
    "Patch rules:\n"
    "- Omit patches if patchContext is missing or the fix is uncertain.\n"
    "- Use the exact finding.patchContext.operation value for operation.\n"
    "- If operation is replace, copy patchContext.oldText verbatim into oldText; do not rewrite it.\n"
    "- If operation is append, do not create an oldText field.\n"
    "- For Dockerfile or docker-compose YAML, ensure newText does not break syntax after application.\n"
    "- Never put ***MASKED***, [MASKED], or <MASKED> values in oldText or newText.\n"
    "- Each patch must contain only operation, oldText, newText. Do not output filePath, expectedFileHash, patchId, or findingId; the code fills them automatically.\n"
)

FIX_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", _FIX_SYSTEM),
        (
            "human",
            (
                "Generate a fix suggestion JSON for the finding below.\n\n"
                "{finding_input}\n\n"
                "JSON format:\n"
                "{{\n"
                '  "summary": "short fix summary",\n'
                '  "priority": "high",\n'
                '  "recommendedActions": ["action 1", "action 2"],\n'
                '  "codeGuidance": "what to change in code or config",\n'
                '  "verification": "how to verify the fix",\n'
                '  "cautions": ["caution 1"],\n'
                '  "patches": [\n'
                "    {{\n"
                '      "operation": "replace",\n'
                '      "oldText": "USER root",\n'
                '      "newText": "USER appuser"\n'
                "    }}\n"
                "  ]\n"
                "}}\n\n"
                "Write all values in Korean. "
                "Omit the patches key entirely if patch conditions are not met."
            ),
        ),
    ]
)


BATCH_FIX_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", _FIX_SYSTEM),
        (
            "human",
            (
                "Generate a fix suggestion JSON array for the findings below.\n\n"
                "{finding_input}\n\n"
                "JSON array format:\n"
                "[\n"
                "  {{\n"
                '    "findingId": "copy the Finding ID exactly",\n'
                '    "summary": "short fix summary",\n'
                '    "priority": "high",\n'
                '    "recommendedActions": ["action 1", "action 2"],\n'
                '    "codeGuidance": "what to change in code or config",\n'
                '    "verification": "how to verify the fix",\n'
                '    "cautions": ["caution 1"],\n'
                '    "patches": [\n'
                "      {{\n"
                '        "operation": "replace",\n'
                '        "oldText": "original text",\n'
                '        "newText": "fixed text"\n'
                "      }}\n"
                "    ]\n"
                "  }}\n"
                "]\n\n"
                "Create one object per finding. Use the Finding ID from the input as the findingId value.\n"
                "Write all values in Korean. "
                "Omit the patches key for any finding whose patch conditions are not met."
            ),
        ),
    ]
)
