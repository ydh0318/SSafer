ALTER TABLE worker_jobs
    ADD COLUMN publish_attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN last_publish_attempt_at TIMESTAMP;

UPDATE worker_jobs
SET publish_attempt_count = CASE
        WHEN job_status IN ('PUBLISHED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED') THEN 1
        ELSE 0
    END,
    last_publish_attempt_at = published_at
WHERE publish_attempt_count = 0;

CREATE INDEX idx_worker_jobs_status_last_publish_attempt
    ON worker_jobs (job_status, last_publish_attempt_at);
