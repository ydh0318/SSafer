import unittest

from app.services.result_service import (
    build_structured_analysis_result,
    normalize_analysis_result_patches,
    validate_analysis_result_item,
    validate_fix_schema,
)


def build_fix(**overrides):
    fix = {
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
    fix.update(overrides)
    return fix


def build_patch(**overrides):
    patch = {
        "patchId": "PATCH-0001",
        "findingId": "FND-0001",
        "filePath": "Dockerfile",
        "operation": "replace",
        "oldText": "USER root",
        "newText": "USER appuser",
        "expectedFileHash": "sha256:abc123",
        "requiresApproval": True,
    }
    patch.update(overrides)
    return patch


def build_finding(**overrides):
    finding = {
        "id": "FND-0001",
        "ruleId": "DOCKER_ROOT_USER",
        "source": "custom-rule",
        "severity": "HIGH",
        "file": "Dockerfile",
        "filePath": "Dockerfile",
        "line": None,
        "title": "Dockerfile runs as root",
        "maskedEvidence": "USER root",
        "patchContext": {
            "oldText": "USER root",
            "expectedFileHash": "sha256:fresh",
        },
    }
    finding.update(overrides)
    return finding


def build_analysis_result_with_patch(patch):
    return {
        "results": [
            {
                "findingId": "FND-0001",
                "fix": build_fix(patches=[patch]),
            }
        ]
    }


class AnalysisResultFixSchemaTest(unittest.TestCase):
    def test_build_structured_analysis_result_accepts_explanation_payload(self):
        result = build_structured_analysis_result(
            finding=build_finding(),
            explanation={
                "explanation": {
                    "summary": "취약점 요약",
                    "whyRisky": "위험한 이유",
                    "abuseScenario": "악용 가능 시나리오",
                    "expectedImpact": "예상 영향",
                    "severityInterpretation": "심각도 해석",
                },
                "impact": "초보자를 위한 쉬운 비유 설명",
            },
            fix=build_fix(),
        )

        self.assertEqual(result["explanation"]["summary"], "취약점 요약")
        self.assertEqual(result["explanation"]["whyRisky"], "위험한 이유")
        self.assertEqual(result["impact"], "초보자를 위한 쉬운 비유 설명")

    def test_validate_analysis_result_item_requires_explanation_sections(self):
        result = build_structured_analysis_result(
            finding=build_finding(),
            explanation="기존 설명",
            fix=build_fix(),
        )
        result["explanation"].pop("whyRisky")

        with self.assertRaisesRegex(ValueError, "whyRisky"):
            validate_analysis_result_item(result, 0)

    def test_validate_analysis_result_item_requires_impact(self):
        result = build_structured_analysis_result(
            finding=build_finding(),
            explanation="기존 설명",
            fix=build_fix(),
        )
        result.pop("impact")

        with self.assertRaisesRegex(ValueError, "impact"):
            validate_analysis_result_item(result, 0)

    def test_validate_fix_schema_accepts_existing_description_only_fix(self):
        validate_fix_schema(build_fix())

    def test_validate_fix_schema_accepts_critical_priority(self):
        validate_fix_schema(build_fix(priority="critical"))

    def test_validate_fix_schema_rejects_unknown_priority(self):
        with self.assertRaisesRegex(ValueError, "priority.*critical, high, medium, low"):
            validate_fix_schema(build_fix(priority="urgent"))

    def test_validate_fix_schema_accepts_empty_cautions(self):
        validate_fix_schema(build_fix(cautions=[]))

    def test_validate_fix_schema_rejects_too_many_cautions(self):
        with self.assertRaisesRegex(ValueError, "cautions must contain 0 to 3 items"):
            validate_fix_schema(build_fix(cautions=["c1", "c2", "c3", "c4"]))

    def test_validate_fix_schema_accepts_optional_replace_patches(self):
        validate_fix_schema(
            build_fix(
                patches=[
                    build_patch(
                        rollback={
                            "operation": "replace",
                            "oldText": "USER appuser",
                            "newText": "USER root",
                        },
                    )
                ]
            )
        )

    def test_validate_fix_schema_accepts_legacy_target_file_and_normalizes(self):
        patch = build_patch(targetFile="Dockerfile")
        patch.pop("filePath")
        fix = build_fix(patches=[patch])

        validate_fix_schema(fix)

        self.assertEqual(fix["patches"][0]["filePath"], "Dockerfile")
        self.assertNotIn("targetFile", fix["patches"][0])

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

    def test_validate_fix_schema_accepts_append_patch_without_old_text(self):
        patch = build_patch(
            operation="append",
            newText="\nHEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost/ || exit 1",
        )
        patch.pop("oldText")

        validate_fix_schema(build_fix(patches=[patch]))

    def test_validate_fix_schema_rejects_append_patch_with_old_text(self):
        with self.assertRaisesRegex(ValueError, "fix.patches\\[0\\].oldText"):
            validate_fix_schema(build_fix(patches=[build_patch(operation="append")]))

    def test_validate_fix_schema_rejects_invalid_patch_metadata(self):
        with self.assertRaisesRegex(ValueError, "fix.patches\\[0\\].expectedFileHash"):
            validate_fix_schema(
                build_fix(patches=[build_patch(expectedFileHash="abc123")])
            )

    def test_validate_fix_schema_rejects_invalid_rollback_operation(self):
        with self.assertRaisesRegex(ValueError, "fix.patches\\[0\\].rollback.operation"):
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

    def test_validate_fix_schema_rejects_unsafe_file_path(self):
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
                    "fix.patches\\[0\\].filePath",
                ):
                    validate_fix_schema(
                        build_fix(patches=[build_patch(filePath=unsafe_path)])
                    )

    def test_validate_fix_schema_rejects_patch_without_user_approval(self):
        with self.assertRaisesRegex(
            ValueError,
            "fix.patches\\[0\\].requiresApproval must be true",
        ):
            validate_fix_schema(build_fix(patches=[build_patch(requiresApproval=False)]))

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

    def test_normalize_analysis_result_patches_adds_file_hash_from_finding_file_path(self):
        analysis_result = build_analysis_result_with_patch(
            build_patch(expectedFileHash="sha256:stale")
        )

        normalize_analysis_result_patches(
            findings=[build_finding()],
            scan_result={"sourceFileHashes": {"Dockerfile": "sha256:fresh"}},
            analysis_result=analysis_result,
        )

        patch = analysis_result["results"][0]["fix"]["patches"][0]
        self.assertEqual(patch["filePath"], "Dockerfile")
        self.assertEqual(patch["expectedFileHash"], "sha256:fresh")
        self.assertEqual(patch["oldText"], "USER root")
        self.assertNotIn("targetFile", patch)

    def test_normalize_analysis_result_patches_removes_patch_without_patch_context(self):
        finding = build_finding()
        finding.pop("patchContext")
        analysis_result = build_analysis_result_with_patch(build_patch())

        normalize_analysis_result_patches(
            findings=[finding],
            scan_result={"sourceFileHashes": {"Dockerfile": "sha256:fresh"}},
            analysis_result=analysis_result,
        )

        self.assertNotIn("patches", analysis_result["results"][0]["fix"])

    def test_normalize_analysis_result_patches_uses_patch_context_old_text_verbatim(self):
        finding = build_finding(
            patchContext={
                "operation": "replace",
                "oldText": "USER    root",
                "expectedFileHash": "sha256:fresh",
            }
        )
        analysis_result = build_analysis_result_with_patch(
            build_patch(oldText="USER root")
        )

        normalize_analysis_result_patches(
            findings=[finding],
            scan_result={
                "sourceFileHashes": {"Dockerfile": "sha256:fresh"},
                "artifacts": [{"target": "Dockerfile", "content": "USER    root\n"}],
            },
            analysis_result=analysis_result,
        )

        self.assertEqual(
            analysis_result["results"][0]["fix"]["patches"][0]["oldText"],
            "USER    root",
        )

    def test_normalize_analysis_result_patches_uses_patch_context_operation(self):
        finding = build_finding(
            patchContext={
                "operation": "replace",
                "oldText": "USER root",
                "expectedFileHash": "sha256:fresh",
            }
        )
        analysis_result = build_analysis_result_with_patch(
            build_patch(operation="append")
        )

        normalize_analysis_result_patches(
            findings=[finding],
            scan_result={"sourceFileHashes": {"Dockerfile": "sha256:fresh"}},
            analysis_result=analysis_result,
        )

        self.assertEqual(
            analysis_result["results"][0]["fix"]["patches"][0]["operation"],
            "replace",
        )

    def test_normalize_analysis_result_patches_accepts_safe_dockerfile_append(self):
        finding = build_finding(
            patchContext={
                "operation": "append",
                "expectedFileHash": "sha256:fresh",
            },
        )
        append_patch = build_patch(
            operation="append",
            newText="\nHEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost/ || exit 1",
        )
        append_patch.pop("oldText")
        analysis_result = build_analysis_result_with_patch(append_patch)

        normalize_analysis_result_patches(
            findings=[finding],
            scan_result={"sourceFileHashes": {"Dockerfile": "sha256:fresh"}},
            analysis_result=analysis_result,
        )

        patch = analysis_result["results"][0]["fix"]["patches"][0]
        self.assertEqual(patch["operation"], "append")
        self.assertNotIn("oldText", patch)
        self.assertEqual(patch["expectedFileHash"], "sha256:fresh")

    def test_normalize_analysis_result_patches_rejects_compose_append(self):
        finding = build_finding(
            file="docker-compose.yml",
            filePath="docker-compose.yml",
            patchContext={
                "expectedFileHash": "sha256:fresh",
            },
        )
        append_patch = build_patch(
            filePath="docker-compose.yml",
            operation="append",
            newText="\nservices: {}",
        )
        append_patch.pop("oldText")
        analysis_result = build_analysis_result_with_patch(append_patch)

        normalize_analysis_result_patches(
            findings=[finding],
            scan_result={"sourceFileHashes": {"docker-compose.yml": "sha256:fresh"}},
            analysis_result=analysis_result,
        )

        self.assertNotIn("patches", analysis_result["results"][0]["fix"])

    def test_normalize_analysis_result_patches_removes_patch_when_file_path_conflicts(self):
        analysis_result = build_analysis_result_with_patch(
            build_patch(filePath="OtherDockerfile")
        )

        normalize_analysis_result_patches(
            findings=[build_finding()],
            scan_result={"sourceFileHashes": {"Dockerfile": "sha256:fresh"}},
            analysis_result=analysis_result,
        )

        self.assertNotIn("patches", analysis_result["results"][0]["fix"])

    def test_normalize_analysis_result_patches_selects_single_target_file_by_old_text(self):
        finding = build_finding(filePath=None, targetFiles=["a.yml", "b.yml"])
        finding.pop("filePath")
        analysis_result = build_analysis_result_with_patch(
            build_patch(filePath="a.yml", oldText="ports:\n  - 5432:5432")
        )

        normalize_analysis_result_patches(
            findings=[finding],
            scan_result={
                "sourceFileHashes": {"a.yml": "sha256:a", "b.yml": "sha256:b"},
                "artifacts": [
                    {
                        "target": "a.yml",
                        "content": "services:\n  db:\n    ports:\n  - 5432:5432\n",
                    },
                    {
                        "target": "b.yml",
                        "content": "services:\n  cache: {}\n",
                    },
                ],
            },
            analysis_result=analysis_result,
        )

        self.assertNotIn("patches", analysis_result["results"][0]["fix"])

    def test_normalize_analysis_result_patches_removes_ambiguous_target_file_patch(self):
        finding = build_finding(filePath=None, targetFiles=["a.yml", "b.yml"])
        finding.pop("filePath")
        analysis_result = build_analysis_result_with_patch(
            build_patch(filePath="a.yml", oldText="USER root")
        )

        normalize_analysis_result_patches(
            findings=[finding],
            scan_result={
                "sourceFileHashes": {"a.yml": "sha256:a", "b.yml": "sha256:b"},
                "artifacts": [
                    {"target": "a.yml", "content": "USER root\n"},
                    {"target": "b.yml", "content": "USER root\n"},
                ],
            },
            analysis_result=analysis_result,
        )

        self.assertNotIn("patches", analysis_result["results"][0]["fix"])


if __name__ == "__main__":
    unittest.main()
