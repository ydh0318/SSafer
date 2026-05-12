import json
import unittest

from app.services.explain_service import parse_explain_response


class ExplainServiceTest(unittest.TestCase):
    def test_parse_explain_response_accepts_explanation_and_impact(self):
        parsed = parse_explain_response(
            json.dumps(
                {
                    "explanation": {
                        "summary": "취약점 요약",
                        "whyRisky": "위험한 이유",
                        "abuseScenario": "악용 가능 시나리오",
                        "expectedImpact": "예상 영향",
                        "severityInterpretation": "심각도 해석",
                    },
                    "impact": "초보자를 위한 쉬운 비유 설명",
                }
            )
        )

        self.assertEqual(parsed["explanation"]["summary"], "취약점 요약")
        self.assertEqual(parsed["explanation"]["whyRisky"], "위험한 이유")
        self.assertEqual(parsed["impact"], "초보자를 위한 쉬운 비유 설명")

    def test_parse_explain_response_keeps_legacy_string_as_fallback(self):
        parsed = parse_explain_response("기존 설명")

        self.assertEqual(parsed["explanation"]["summary"], "기존 설명")
        self.assertEqual(parsed["explanation"]["whyRisky"], "기존 설명")
        self.assertEqual(parsed["impact"], "기존 설명")

    def test_parse_explain_response_rejects_missing_impact(self):
        with self.assertRaisesRegex(ValueError, "impact"):
            parse_explain_response(
                json.dumps(
                    {
                        "explanation": {
                            "summary": "취약점 요약",
                            "whyRisky": "위험한 이유",
                            "abuseScenario": "악용 가능 시나리오",
                            "expectedImpact": "예상 영향",
                            "severityInterpretation": "심각도 해석",
                        }
                    }
                )
            )

    def test_parse_explain_response_rejects_missing_explanation_section(self):
        with self.assertRaisesRegex(ValueError, "whyRisky"):
            parse_explain_response(
                json.dumps(
                    {
                        "explanation": {
                            "summary": "취약점 요약",
                            "abuseScenario": "악용 가능 시나리오",
                            "expectedImpact": "예상 영향",
                            "severityInterpretation": "심각도 해석",
                        },
                        "impact": "초보자를 위한 쉬운 비유 설명",
                    }
                )
            )


if __name__ == "__main__":
    unittest.main()
