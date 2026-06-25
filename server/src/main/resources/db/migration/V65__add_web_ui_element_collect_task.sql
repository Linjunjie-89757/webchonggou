CREATE TABLE IF NOT EXISTS tb_web_ui_element_collect_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    runner_id VARCHAR(128),
    session_id VARCHAR(128),
    status VARCHAR(32) NOT NULL,
    source VARCHAR(64) NOT NULL,
    actual_url VARCHAR(1024),
    page_title VARCHAR(255),
    module_id BIGINT,
    page_id BIGINT,
    page_name VARCHAR(128),
    ai_model_config_id BIGINT,
    ai_model_name VARCHAR(128),
    raw_count INT NOT NULL DEFAULT 0,
    final_count INT NOT NULL DEFAULT 0,
    snapshot_json CLOB,
    candidates_json CLOB,
    global_screenshot_base64 CLOB,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_web_ui_element_collect_task_workspace ON tb_web_ui_element_collect_task(workspace_id);
CREATE INDEX IF NOT EXISTS idx_web_ui_element_collect_task_session ON tb_web_ui_element_collect_task(runner_id, session_id);
CREATE INDEX IF NOT EXISTS idx_web_ui_element_collect_task_status ON tb_web_ui_element_collect_task(workspace_id, status);
