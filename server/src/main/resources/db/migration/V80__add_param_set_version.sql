CREATE TABLE IF NOT EXISTS tb_param_set_version (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    param_set_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    param_type VARCHAR(64) NOT NULL,
    param_name VARCHAR(128) NOT NULL,
    content_json TEXT,
    status INT NOT NULL DEFAULT 1,
    change_type VARCHAR(32) NOT NULL,
    changed_fields VARCHAR(255),
    source_version_id BIGINT,
    operator_id BIGINT,
    operator_name VARCHAR(128),
    is_latest BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_param_set_version_param_set_id
    ON tb_param_set_version (param_set_id, version_no);

CREATE INDEX IF NOT EXISTS idx_param_set_version_latest
    ON tb_param_set_version (param_set_id, is_latest);
