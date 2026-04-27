ALTER TABLE scans
    DROP CONSTRAINT IF EXISTS chk_scans_status;

ALTER TABLE scans
    ADD CONSTRAINT chk_scans_status
        CHECK (status IN ('REQUESTED', 'QUEUED', 'RUNNING', 'RAW_UPLOADED', 'DONE', 'FAILED', 'CANCELED'));
