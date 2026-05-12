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
        self.assertIn("operation: append", rendered_prompt)
        self.assertIn("PATCH-{findingId}", rendered_prompt)
        self.assertIn("If patch requirements are not satisfied", rendered_prompt)
        self.assertIn("***MASKED***", rendered_prompt)

    def test_fix_retry_prompt_includes_patches_safety_rules(self):
        retry_prompt = build_fix_retry_prompt(
            finding_input="Finding ID: FND-0001",
            error_message="patches field failed validation",
        )

        self.assertIn("patches field failed validation", retry_prompt)
        self.assertIn("finding.patchContext", retry_prompt)
        self.assertIn("patches[].operation must be replace or append.", retry_prompt)
        self.assertIn("patches[].filePath", retry_prompt)
        self.assertIn("docker-compose YAML", retry_prompt)
        self.assertIn("***MASKED***", retry_prompt)


if __name__ == "__main__":
    unittest.main()
