ALTER TABLE scans
    ADD COLUMN external_scan_id VARCHAR(100);

ALTER TABLE scan_findings
    ADD COLUMN line_number INTEGER;

CREATE INDEX idx_scans_external_scan_id
    ON scans (external_scan_id);
