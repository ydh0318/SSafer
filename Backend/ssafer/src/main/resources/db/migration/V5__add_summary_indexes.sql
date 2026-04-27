CREATE INDEX idx_scan_findings_scan_id_category
    ON scan_findings (scan_id, category);

CREATE INDEX idx_scan_findings_scan_id_source_type
    ON scan_findings (scan_id, source_type);

CREATE INDEX idx_scan_findings_scan_id_resolution_status
    ON scan_findings (scan_id, resolution_status);
