import unittest

from app.prompts.fix_prompt import FIX_PROMPT
from app.services.fix_service import build_fix_retry_prompt


class FixPromptTest(unittest.TestCase):
    def test_fix_prompt_includes_optional_patches_contract(self):
        messages = FIX_PROMPT.format_messages(finding_input="Finding ID: FND-0001")
        rendered_prompt = "\n".join(message.content for message in messages)

        self.assertIn('"patches"', rendered_prompt)
        self.assertIn('"operation": "replace"', rendered_prompt)
        self.assertIn("patchContext.oldText", rendered_prompt)
        self.assertIn(
            "If operation is append, do not create an oldText field.",
            rendered_prompt,
        )
        self.assertIn(
            "Each patch must contain only operation, oldText, newText.",
            rendered_prompt,
        )
        self.assertIn(
            "Do not output filePath, expectedFileHash, patchId, or findingId",
            rendered_prompt,
        )
        self.assertIn("Omit patches if patchContext is missing", rendered_prompt)
        self.assertIn(
            "Write all user-facing natural-language fields in Korean",
            rendered_prompt,
        )
        self.assertIn("***MASKED***", rendered_prompt)
        self.assertIn("server-audit", rendered_prompt)

    def test_fix_retry_prompt_includes_patch_safety_rules(self):
        retry_prompt = build_fix_retry_prompt(
            finding_input="Finding ID: FND-0001",
            error_message="patches field failed validation",
        )

        self.assertIn("patches field failed validation", retry_prompt)
        self.assertIn("patchContext.oldText", retry_prompt)
        self.assertIn(
            "If operation is append, do not create oldText.",
            retry_prompt,
        )
        self.assertIn(
            "Each patch must contain only operation, oldText, newText.",
            retry_prompt,
        )
        self.assertIn(
            "Do not output filePath, expectedFileHash, patchId, or findingId",
            retry_prompt,
        )
        self.assertIn(
            "Write all natural-language values in Korean.",
            retry_prompt,
        )
        self.assertIn("server-audit", retry_prompt)


if __name__ == "__main__":
    unittest.main()
