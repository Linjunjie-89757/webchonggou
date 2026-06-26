CREATE TABLE IF NOT EXISTS tb_param_set_change_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    param_set_id BIGINT NOT NULL,
    param_name VARCHAR(128),
    change_type VARCHAR(32) NOT NULL,
    before_json TEXT,
    after_json TEXT,
    changed_fields VARCHAR(255),
    operator_id BIGINT,
    operator_name VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_param_set_change_history_param_set_id (param_set_id, created_at)
);
