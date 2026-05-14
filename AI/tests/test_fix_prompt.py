import unittest

from app.prompts.fix_prompt import FIX_PROMPT
from app.services.fix_service import build_fix_retry_prompt


class FixPromptTest(unittest.TestCase):
    def test_fix_prompt_includes_optional_patches_contract(self):
        messages = FIX_PROMPT.format_messages(finding_input="Finding ID: FND-0001")
        rendered_prompt = "\n".join(message.content for message in messages)

        self.assertIn('"patches"', rendered_prompt)
        self.assertIn('"operation": "replace"', rendered_prompt)
        self.assertIn('"filePath": "Dockerfile"', rendered_prompt)
        self.assertIn("patchContext.oldText", rendered_prompt)
        self.assertIn("operation이 append면 oldText를 만들지 마세요", rendered_prompt)
        self.assertIn("targetFiles", rendered_prompt)
        self.assertIn("PATCH-{findingId}", rendered_prompt)
        self.assertIn("패치 조건을 만족하지 못하면", rendered_prompt)
        self.assertIn("한국어 중심", rendered_prompt)
        self.assertIn("***MASKED***", rendered_prompt)
        self.assertIn("server-audit", rendered_prompt)

    def test_fix_retry_prompt_includes_patch_safety_rules(self):
        retry_prompt = build_fix_retry_prompt(
            finding_input="Finding ID: FND-0001",
            error_message="patches field failed validation",
        )

        self.assertIn("patches field failed validation", retry_prompt)
        self.assertIn("patchContext.oldText", retry_prompt)
        self.assertIn("operation이 append면 oldText를 새로 만들지 마세요", retry_prompt)
        self.assertIn("targetFiles 후보", retry_prompt)
        self.assertIn("한국어 중심", retry_prompt)
        self.assertIn("server-audit", retry_prompt)


if __name__ == "__main__":
    unittest.main()
