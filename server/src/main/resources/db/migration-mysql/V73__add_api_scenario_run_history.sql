CREATE TABLE IF NOT EXISTS tb_api_scenario_run_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    scenario_id BIGINT NOT NULL,
    scenario_name VARCHAR(255) NOT NULL,
    report_id BIGINT,
    result VARCHAR(32) NOT NULL,
    failure_summary TEXT,
    total_count INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    skipped_count INT NOT NULL DEFAULT 0,
    duration_ms BIGINT NOT NULL DEFAULT 0,
    environment_id BIGINT,
    variable_set_id BIGINT,
    test_dataset_id BIGINT,
    test_dataset_name VARCHAR(255),
    loop_count INT NOT NULL DEFAULT 1,
    thread_count INT NOT NULL DEFAULT 1,
    data_iteration_json LONGTEXT,
    detail_json LONGTEXT,
    operator_id BIGINT,
    operator_name VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_scenario_run_history_scenario
    ON tb_api_scenario_run_history (scenario_id, created_at);
