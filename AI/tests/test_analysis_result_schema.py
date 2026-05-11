import unittest

from app.services.result_service import validate_fix_schema


def build_fix(**overrides):
    fix = {
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
    fix.update(overrides)
    return fix


class AnalysisResultFixSchemaTest(unittest.TestCase):
    def test_validate_fix_schema_accepts_existing_description_only_fix(self):
        validate_fix_schema(build_fix())

    def test_validate_fix_schema_accepts_optional_replace_patches(self):
        validate_fix_schema(
            build_fix(
                patches=[
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
                ]
            )
        )

    def test_validate_fix_schema_rejects_patch_missing_required_field(self):
        with self.assertRaisesRegex(ValueError, "fix.patches\\[0\\] missing required fields"):
            validate_fix_schema(
                build_fix(
                    patches=[
                        {
                            "patchId": "PATCH-0001",
                            "operation": "replace",
                            "oldText": "USER root",
                        }
                    ]
                )
            )

    def test_validate_fix_schema_rejects_unsupported_patch_operation(self):
        with self.assertRaisesRegex(ValueError, "fix.patches\\[0\\].operation"):
            validate_fix_schema(
                build_fix(
                    patches=[
                        {
                            "patchId": "PATCH-0001",
                            "targetFile": "Dockerfile",
                            "operation": "append",
                            "oldText": "USER root",
                            "newText": "USER appuser",
                            "requiresApproval": True,
                        }
                    ]
                )
            )

    def test_validate_fix_schema_rejects_invalid_patch_metadata(self):
        with self.assertRaisesRegex(ValueError, "fix.patches\\[0\\].expectedFileHash"):
            validate_fix_schema(
                build_fix(
                    patches=[
                        {
                            "patchId": "PATCH-0001",
                            "targetFile": "Dockerfile",
                            "operation": "replace",
                            "oldText": "USER root",
                            "newText": "USER appuser",
                            "expectedFileHash": "abc123",
                            "requiresApproval": True,
                        }
                    ]
                )
            )

    def test_validate_fix_schema_rejects_invalid_rollback_operation(self):
        with self.assertRaisesRegex(
            ValueError,
            "fix.patches\\[0\\].rollback.operation",
        ):
            validate_fix_schema(
                build_fix(
                    patches=[
                        {
                            "patchId": "PATCH-0001",
                            "targetFile": "Dockerfile",
                            "operation": "replace",
                            "oldText": "USER root",
                            "newText": "USER appuser",
                            "requiresApproval": True,
                            "rollback": {
                                "operation": "append",
                                "oldText": "USER appuser",
                                "newText": "USER root",
                            },
                        }
                    ]
                )
            )


if __name__ == "__main__":
    unittest.main()
