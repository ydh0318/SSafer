CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL,
    guest_owner_key_hash VARCHAR(255) NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    default_scan_mode VARCHAR(20) NOT NULL DEFAULT 'AGENT',
    default_rule_set_id BIGINT NULL,
    monitor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_projects_user_id_deleted_at
    ON projects (user_id, deleted_at);

CREATE INDEX idx_projects_guest_owner_key_hash_deleted_at
    ON projects (guest_owner_key_hash, deleted_at);

CREATE INDEX idx_projects_created_at
    ON projects (created_at DESC);
