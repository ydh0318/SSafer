import unittest

from app.core.logging_utils import format_log_fields


class LoggingUtilsTest(unittest.TestCase):
    def test_format_log_fields_skips_none_values(self):
        self.assertEqual(
            format_log_fields(scanId=5, errorCode=None, durationMs=12),
            "scanId=5 durationMs=12",
        )


if __name__ == "__main__":
    unittest.main()
