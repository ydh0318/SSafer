import json
import unittest
from unittest.mock import Mock, patch

from app.services.fix_service import generate_finding_fix, parse_fix_response


DESCRIPTION_ONLY_FIX = {
    "summary": "Dockerfile에서 root 사용자 실행을 제거합니다.",
    "priority": "high",
    "recommendedActions": [
        "비 root 사용자를 생성합니다.",
        "USER 지시문을 비 root 사용자로 변경합니다.",
    ],
    "codeGuidance": "Dockerfile의 USER root 지시문을 비 root 사용자로 바꿉니다.",
    "verification": "컨테이너가 비 root 사용자로 실행되는지 확인합니다.",
    "cautions": ["기존 권한이 필요한 경로는 소유자를 함께 조정합니다."],
}


PATCH_FIX = {
    **DESCRIPTION_ONLY_FIX,
    "patches": [
        {
            "patchId": "PATCH-0001",
            "targetFile": "Dockerfile",
            "operation": "replace",
            "oldText": "USER root",
            "newText": "USER appuser",
            "expectedFileHash": "sha256:abc123",
            "requiresApproval": True,
            "rollback": {
                "operation": "replace",
                "oldText": "USER appuser",
                "newText": "USER root",
            },
        }
    ],
}


def build_finding():
    return {
        "id": "FND-0001",
        "ruleId": "DOCKER_RUN_AS_ROOT",
        "source": "custom-rule",
        "severity": "HIGH",
        "file": "Dockerfile",
        "line": 12,
        "title": "Dockerfile이 root 사용자로 실행됨",
        "maskedEvidence": "USER root",
    }


class FixServiceTest(unittest.TestCase):
    def test_parse_fix_response_accepts_description_only_fixture(self):
        parsed = parse_fix_response(json.dumps(DESCRIPTION_ONLY_FIX))

        self.assertEqual(parsed["summary"], DESCRIPTION_ONLY_FIX["summary"])
        self.assertNotIn("patches", parsed)

    def test_parse_fix_response_accepts_patch_fixture(self):
        parsed = parse_fix_response(json.dumps(PATCH_FIX))

        self.assertEqual(parsed["patches"][0]["patchId"], "PATCH-0001")
        self.assertTrue(parsed["patches"][0]["requiresApproval"])

    def test_parse_fix_response_rejects_invalid_patch_fixture(self):
        invalid_fix = {
            **PATCH_FIX,
            "patches": [
                {
                    **PATCH_FIX["patches"][0],
                    "requiresApproval": False,
                }
            ],
        }

        with self.assertRaisesRegex(
            ValueError,
            "Fix Chain output failed schema validation",
        ):
            parse_fix_response(json.dumps(invalid_fix))

    def test_generate_finding_fix_retries_after_invalid_patch_output(self):
        invalid_fix = {
            **PATCH_FIX,
            "patches": [
                {
                    **PATCH_FIX["patches"][0],
                    "operation": "append",
                }
            ],
        }

        chain = Mock()
        responses = [
            json.dumps(invalid_fix),
            json.dumps(DESCRIPTION_ONLY_FIX),
        ]

        with patch(
            "app.services.fix_service.create_fix_chain",
            return_value=chain,
        ), patch(
            "app.services.fix_service.invoke_llm_with_retry",
            side_effect=responses,
        ) as invoke:
            fix = generate_finding_fix(build_finding())

        self.assertEqual(fix["summary"], DESCRIPTION_ONLY_FIX["summary"])
        self.assertEqual(invoke.call_count, 2)
        retry_prompt = invoke.call_args_list[1].args[1]["finding_input"]
        self.assertIn("실패 사유", retry_prompt)
        self.assertIn("Fix Chain output failed schema validation", retry_prompt)
        self.assertIn("patches[].operation은 replace만 사용하세요.", retry_prompt)


if __name__ == "__main__":
    unittest.main()
