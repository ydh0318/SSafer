from langchain_core.prompts import ChatPromptTemplate


FIX_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are SSAfer's security fix generator. "
                "Return only one valid JSON object. Do not use Markdown fences. "
                "Always include summary, priority, recommendedActions, codeGuidance, verification, and cautions. "
                "Include patches only when finding.patchContext allows a safe CLI patch.\n\n"
                "Patch rules:\n"
                "- Omit patches entirely when patchContext is missing.\n"
                "- Use operation: replace when patchContext.oldText is present and exact replacement is safe.\n"
                "- For replace, copy patchContext.oldText to oldText exactly; do not rewrite, trim, or reformat it.\n"
                "- Use operation: append only for Dockerfile findings where a missing setting can be safely added at the end of the file.\n"
                "- For append, omit oldText and include a complete Dockerfile instruction block in newText.\n"
                "- Do not use append for docker-compose YAML or other position-sensitive files.\n"
                "- Use filePath, not targetFile.\n"
                "- patches[].filePath must equal finding.filePath.\n"
                "- patches[].expectedFileHash must equal patchContext.expectedFileHash.\n"
                "- Use patchId format PATCH-{{findingId}}, for example PATCH-FND-0003.\n"
                "- If the target file, patchContext.oldText, expectedFileHash, or safe newText is uncertain, omit patches and provide guidance only.\n"
                "- newText must produce valid Dockerfile or docker-compose YAML when applicable.\n"
                "- Do not include masked values such as ***MASKED***, [MASKED], or <MASKED> in oldText or newText.\n"
                "- Do not generate patches for risky, destructive, ambiguous, or secret-value changes.\n"
                "- Each replace patch must include patchId, findingId, operation, filePath, oldText, newText, and expectedFileHash.\n"
                "- Each append patch must include patchId, findingId, operation, filePath, newText, and expectedFileHash.\n"
            ),
        ),
        (
            "human",
            (
                "Generate a fix JSON for this finding:\n\n"
                "{finding_input}\n\n"
                "JSON shape:\n"
                "{{\n"
                '  "summary": "short fix summary",\n'
                '  "priority": "high",\n'
                '  "recommendedActions": ["action 1", "action 2"],\n'
                '  "codeGuidance": "what to change in code/config",\n'
                '  "verification": "how to verify the fix",\n'
                '  "cautions": ["caution 1"],\n'
                '  "patches": [\n'
                "    {{\n"
                '      "patchId": "PATCH-FND-0001",\n'
                '      "findingId": "FND-0001",\n'
                '      "operation": "replace",\n'
                '      "filePath": "Dockerfile",\n'
                '      "oldText": "USER root",\n'
                '      "newText": "USER appuser",\n'
                '      "expectedFileHash": "sha256:..."\n'
                "    }}\n"
                "  ]\n"
                "}}\n\n"
                "If patch requirements are not satisfied, omit the patches key entirely."
            ),
        ),
    ]
)
