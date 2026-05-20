import json
import unittest
from unittest.mock import Mock, patch

from app.services.fix_service import generate_finding_fix, parse_fix_response


DESCRIPTION_ONLY_FIX = {
    "summary": "Run Dockerfile with a non-root user.",
    "priority": "high",
    "recommendedActions": [
        "Create a non-root user in the Dockerfile.",
        "Switch to the non-root user before the runtime command.",
    ],
    "codeGuidance": "Add a USER instruction that uses a non-root account.",
    "verification": "Build the image and verify the container user is not root.",
    "cautions": ["Ensure the new user can read application files."],
}


PATCH_FIX = {
    **DESCRIPTION_ONLY_FIX,
    "patches": [
        {
            "patchId": "PATCH-0001",
            "findingId": "FND-0001",
            "filePath": "Dockerfile",
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
        "filePath": "Dockerfile",
        "line": 12,
        "title": "Dockerfile runs as root",
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
        self.assertEqual(parsed["patches"][0]["filePath"], "Dockerfile")
        self.assertTrue(parsed["patches"][0]["requiresApproval"])

    def test_parse_fix_response_drops_noop_patch(self):
        noop_fix = {
            **DESCRIPTION_ONLY_FIX,
            "patches": [
                {"operation": "replace", "oldText": "USER root", "newText": "USER root"}
            ],
        }

        parsed = parse_fix_response(json.dumps(noop_fix))

        # no-op 패치는 검증 실패가 아니라 드롭되고, fix 본문은 유지된다.
        self.assertNotIn("patches", parsed)
        self.assertEqual(parsed["summary"], DESCRIPTION_ONLY_FIX["summary"])

    def test_parse_fix_response_drops_noop_keeps_valid_patch(self):
        mixed_fix = {
            **DESCRIPTION_ONLY_FIX,
            "patches": [
                {"operation": "replace", "oldText": "USER root", "newText": "USER root"},
                PATCH_FIX["patches"][0],
            ],
        }

        parsed = parse_fix_response(json.dumps(mixed_fix))

        self.assertEqual(len(parsed["patches"]), 1)
        self.assertEqual(parsed["patches"][0]["newText"], "USER appuser")

    def test_parse_fix_response_accepts_legacy_target_file_and_normalizes(self):
        legacy_fix = {
            **DESCRIPTION_ONLY_FIX,
            "patches": [
                {
                    **PATCH_FIX["patches"][0],
                    "targetFile": "Dockerfile",
                }
            ],
        }
        legacy_fix["patches"][0].pop("filePath")

        parsed = parse_fix_response(json.dumps(legacy_fix))

        self.assertEqual(parsed["patches"][0]["filePath"], "Dockerfile")
        self.assertNotIn("targetFile", parsed["patches"][0])

    def test_parse_fix_response_accepts_critical_priority(self):
        critical_fix = {**DESCRIPTION_ONLY_FIX, "priority": "critical"}

        parsed = parse_fix_response(json.dumps(critical_fix))

        self.assertEqual(parsed["priority"], "critical")

    def test_parse_fix_response_rejects_unknown_priority(self):
        invalid_fix = {**DESCRIPTION_ONLY_FIX, "priority": "urgent"}

        with self.assertRaisesRegex(ValueError, "priority.*critical, high, medium, low"):
            parse_fix_response(json.dumps(invalid_fix))

    def test_parse_fix_response_accepts_empty_cautions(self):
        empty_cautions_fix = {**DESCRIPTION_ONLY_FIX, "cautions": []}

        parsed = parse_fix_response(json.dumps(empty_cautions_fix))

        self.assertEqual(parsed["cautions"], [])

    def test_parse_fix_response_rejects_too_many_cautions(self):
        too_many_cautions_fix = {
            **DESCRIPTION_ONLY_FIX,
            "cautions": ["c1", "c2", "c3", "c4"],
        }

        with self.assertRaisesRegex(ValueError, "cautions.*0 to 3 items"):
            parse_fix_response(json.dumps(too_many_cautions_fix))

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
                    "requiresApproval": False,
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
        self.assertIn("Validation error:", retry_prompt)
        self.assertIn("Fix Chain output failed schema validation", retry_prompt)
        self.assertIn(
            "If operation is append, do not create oldText.",
            retry_prompt,
        )


if __name__ == "__main__":
    unittest.main()
