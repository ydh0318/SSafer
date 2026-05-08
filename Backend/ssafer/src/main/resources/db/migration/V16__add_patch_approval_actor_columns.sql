ALTER TABLE scan_findings
    ADD COLUMN patch_approved_actor_type VARCHAR(20);

ALTER TABLE scan_findings
    ADD COLUMN patch_approved_by_guest_owner_key_hash VARCHAR(255);
