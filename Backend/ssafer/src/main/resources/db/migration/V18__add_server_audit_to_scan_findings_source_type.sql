ALTER TABLE scan_findings
    DROP CONSTRAINT IF EXISTS chk_scan_findings_source_type;

ALTER TABLE scan_findings
    ADD CONSTRAINT chk_scan_findings_source_type
        CHECK (source_type IN ('TRIVY', 'CUSTOM_RULE', 'AI', 'SERVER_AUDIT'));
