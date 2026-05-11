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


def build_patch(**overrides):
    patch = {
        "patchId": "PATCH-0001",
        "targetFile": "Dockerfile",
        "operation": "replace",
        "oldText": "USER root",
        "newText": "USER appuser",
        "requiresApproval": True,
    }
    patch.update(overrides)
    return patch


class AnalysisResultFixSchemaTest(unittest.TestCase):
    def test_validate_fix_schema_accepts_existing_description_only_fix(self):
        validate_fix_schema(build_fix())

    def test_validate_fix_schema_accepts_optional_replace_patches(self):
        validate_fix_schema(
            build_fix(
                patches=[
                    build_patch(
                        expectedFileHash="sha256:abc123",
                        rollback={
                            "operation": "replace",
                            "oldText": "USER appuser",
                            "newText": "USER root",
                        },
                    )
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
                        build_patch(
                            operation="append",
                        )
                    ]
                )
            )

    def test_validate_fix_schema_rejects_invalid_patch_metadata(self):
        with self.assertRaisesRegex(ValueError, "fix.patches\\[0\\].expectedFileHash"):
            validate_fix_schema(
                build_fix(
                    patches=[
                        build_patch(
                            expectedFileHash="abc123",
                        )
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
                        build_patch(
                            rollback={
                                "operation": "append",
                                "oldText": "USER appuser",
                                "newText": "USER root",
                            },
                        )
                    ]
                )
            )

    def test_validate_fix_schema_rejects_unsafe_target_file(self):
        unsafe_paths = (
            "/etc/passwd",
            "../Dockerfile",
            "src/../Dockerfile",
            "~/.ssh/config",
            "src\\Dockerfile",
        )

        for unsafe_path in unsafe_paths:
            with self.subTest(unsafe_path=unsafe_path):
                with self.assertRaisesRegex(
                    ValueError,
                    "fix.patches\\[0\\].targetFile",
                ):
                    validate_fix_schema(
                        build_fix(patches=[build_patch(targetFile=unsafe_path)])
                    )

    def test_validate_fix_schema_rejects_patch_without_user_approval(self):
        with self.assertRaisesRegex(
            ValueError,
            "fix.patches\\[0\\].requiresApproval must be true",
        ):
            validate_fix_schema(
                build_fix(patches=[build_patch(requiresApproval=False)])
            )

    def test_validate_fix_schema_rejects_noop_replacement(self):
        with self.assertRaisesRegex(ValueError, "oldText.*newText"):
            validate_fix_schema(
                build_fix(
                    patches=[
                        build_patch(
                            oldText="USER appuser",
                            newText="USER appuser",
                        )
                    ]
                )
            )

    def test_validate_fix_schema_rejects_masked_patch_text(self):
        with self.assertRaisesRegex(ValueError, "masked values"):
            validate_fix_schema(
                build_fix(
                    patches=[
                        build_patch(
                            oldText="DB_PASSWORD=***MASKED***",
                            newText="DB_PASSWORD=new-value",
                        )
                    ]
                )
            )


if __name__ == "__main__":
    unittest.main()
