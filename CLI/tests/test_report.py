from ssafer.main import _format_report_evidence


def test_format_report_evidence_uses_dash_for_empty_values():
    assert _format_report_evidence(None) == "-"
    assert _format_report_evidence("") == "-"
    assert _format_report_evidence("   ") == "-"


def test_format_report_evidence_flattens_newlines():
    assert _format_report_evidence("line1\nline2\r\nline3") == "line1 line2  line3"


def test_format_report_evidence_truncates_long_text():
    evidence = "A" * 100
    formatted = _format_report_evidence(evidence)

    assert len(formatted) == 80
    assert formatted.endswith("...")
