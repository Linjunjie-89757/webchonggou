CREATE TABLE IF NOT EXISTS tb_web_ui_element_collect_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    runner_id VARCHAR(128) NULL,
    session_id VARCHAR(128) NULL,
    status VARCHAR(32) NOT NULL,
    source VARCHAR(64) NOT NULL,
    actual_url VARCHAR(1024) NULL,
    page_title VARCHAR(255) NULL,
    module_id BIGINT NULL,
    page_id BIGINT NULL,
    page_name VARCHAR(128) NULL,
    ai_model_config_id BIGINT NULL,
    ai_model_name VARCHAR(128) NULL,
    raw_count INT NOT NULL DEFAULT 0,
    final_count INT NOT NULL DEFAULT 0,
    snapshot_json LONGTEXT NULL,
    candidates_json LONGTEXT NULL,
    global_screenshot_base64 LONGTEXT NULL,
    completed_at TIMESTAMP NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_web_ui_element_collect_task_workspace ON tb_web_ui_element_collect_task(workspace_id);
CREATE INDEX idx_web_ui_element_collect_task_session ON tb_web_ui_element_collect_task(runner_id, session_id);
CREATE INDEX idx_web_ui_element_collect_task_status ON tb_web_ui_element_collect_task(workspace_id, status);
