ALTER TABLE scans
    ADD COLUMN deleted_at TIMESTAMP NULL;

CREATE INDEX idx_scans_project_id_deleted_at
    ON scans (project_id, deleted_at);

CREATE INDEX idx_scans_requested_by_user_id_deleted_at
    ON scans (requested_by_user_id, deleted_at);
