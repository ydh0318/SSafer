ALTER TABLE scan_findings
    ADD COLUMN resolution_status_source VARCHAR(20),
    ADD COLUMN resolution_status_changed_at TIMESTAMP,
    ADD COLUMN resolution_status_changed_actor_type VARCHAR(20),
    ADD COLUMN resolution_status_changed_by_user_id BIGINT,
    ADD COLUMN resolution_status_changed_by_guest_owner_key_hash VARCHAR(255);

ALTER TABLE scan_findings
    ADD CONSTRAINT chk_scan_findings_resolution_status_source
        CHECK (resolution_status_source IS NULL OR resolution_status_source IN ('MANUAL', 'PATCH'));

ALTER TABLE scan_findings
    ADD CONSTRAINT chk_scan_findings_resolution_status_changed_actor_type
        CHECK (
            resolution_status_changed_actor_type IS NULL
            OR resolution_status_changed_actor_type IN ('USER', 'GUEST', 'SYSTEM')
        );
