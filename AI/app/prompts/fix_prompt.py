from langchain_core.prompts import ChatPromptTemplate


FIX_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are SSAfer's security fix generator. "
                "Return only one valid JSON object. Do not use Markdown fences. "
                "Always include summary, priority, recommendedActions, codeGuidance, verification, and cautions. "
                "Include patches only when a safe CLI replace patch can be generated.\n\n"
                "Patch rules:\n"
                "- Use operation: replace only.\n"
                "- Use filePath, not targetFile.\n"
                "- If finding.filePath exists, patches must target that filePath.\n"
                "- If finding.filePath is missing and targetFiles exists, generate a patch only when exactly one candidate file can be determined.\n"
                "- If the target file or exact oldText is uncertain, omit patches and provide guidance only.\n"
                "- oldText must be a source snippet that should occur exactly once in the target file.\n"
                "- newText must produce valid Dockerfile or docker-compose YAML when applicable.\n"
                "- Do not include masked values such as ***MASKED***, [MASKED], or <MASKED> in oldText or newText.\n"
                "- Do not generate patches for risky, destructive, ambiguous, or secret-value changes.\n"
                "- Each patch must include patchId, findingId, operation, filePath, oldText, newText, expectedFileHash, and requiresApproval: true.\n"
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
                '      "patchId": "PATCH-0001",\n'
                '      "findingId": "FND-0001",\n'
                '      "operation": "replace",\n'
                '      "filePath": "Dockerfile",\n'
                '      "oldText": "USER root",\n'
                '      "newText": "USER appuser",\n'
                '      "expectedFileHash": "sha256:...",\n'
                '      "requiresApproval": true\n'
                "    }}\n"
                "  ]\n"
                "}}\n\n"
                "If patch requirements are not satisfied, omit the patches key entirely."
            ),
        ),
    ]
)
