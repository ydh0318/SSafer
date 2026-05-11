import unittest

from app.prompts.fix_prompt import FIX_PROMPT
from app.services.fix_service import build_fix_retry_prompt


class FixPromptTest(unittest.TestCase):
    def test_fix_prompt_includes_optional_patches_contract(self):
        messages = FIX_PROMPT.format_messages(finding_input="탐지 ID: FND-0001")
        rendered_prompt = "\n".join(message.content for message in messages)

        self.assertIn('"patches"', rendered_prompt)
        self.assertIn('"requiresApproval": true', rendered_prompt)
        self.assertIn('"operation": "replace"', rendered_prompt)
        self.assertIn("조건을 만족하지 못하면 key 자체를 생략", rendered_prompt)
        self.assertIn("maskedEvidence처럼 마스킹된 값만", rendered_prompt)

    def test_fix_retry_prompt_includes_patches_safety_rules(self):
        retry_prompt = build_fix_retry_prompt(
            finding_input="탐지 ID: FND-0001",
            error_message="patches field failed validation",
        )

        self.assertIn("patches는 선택 key입니다", retry_prompt)
        self.assertIn("requiresApproval은 반드시 true", retry_prompt)
        self.assertIn("operation은 replace만", retry_prompt)
        self.assertIn("정확한 targetFile, oldText, newText를 알 수 없으면", retry_prompt)
        self.assertIn("***MASKED***", retry_prompt)


if __name__ == "__main__":
    unittest.main()
