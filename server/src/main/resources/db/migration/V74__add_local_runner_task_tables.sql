CREATE TABLE IF NOT EXISTS tb_local_runner_node (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runner_id VARCHAR(128) NOT NULL,
    install_id VARCHAR(128),
    runner_token VARCHAR(255),
    runner_name VARCHAR(255),
    runner_version VARCHAR(64),
    protocol_version VARCHAR(64),
    capabilities_json LONGTEXT,
    machine_hint_json LONGTEXT,
    resource_json LONGTEXT,
    browser_json LONGTEXT,
    session_json LONGTEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ONLINE',
    last_heartbeat_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_local_runner_node_runner_id
    ON tb_local_runner_node (runner_id);

CREATE INDEX IF NOT EXISTS idx_local_runner_node_install_id
    ON tb_local_runner_node (install_id);

CREATE TABLE IF NOT EXISTS tb_local_runner_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT,
    workspace_code VARCHAR(128),
    run_id VARCHAR(128) NOT NULL,
    task_type VARCHAR(64) NOT NULL,
    execution_location VARCHAR(64) NOT NULL DEFAULT 'LOCAL_RUNNER',
    execution_token VARCHAR(255) NOT NULL,
    runner_id VARCHAR(128),
    user_id VARCHAR(128),
    protocol_version VARCHAR(64),
    priority VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    resource_cost INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    current_stage VARCHAR(64),
    progress_current INT NOT NULL DEFAULT 0,
    progress_total INT NOT NULL DEFAULT 0,
    progress_percent INT NOT NULL DEFAULT 0,
    status_message TEXT,
    error_message TEXT,
    timeout_policy_json LONGTEXT,
    environment_snapshot_json LONGTEXT,
    variable_snapshot_json LONGTEXT,
    script_snapshot_json LONGTEXT,
    artifact_refs_json LONGTEXT,
    masking_rules_json LONGTEXT,
    screenshot_policy_json LONGTEXT,
    payload_json LONGTEXT,
    result_json LONGTEXT,
    deadline_at TIMESTAMP,
    assigned_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    last_reported_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_local_runner_task_run_id
    ON tb_local_runner_task (run_id);

CREATE INDEX IF NOT EXISTS idx_local_runner_task_runner_status
    ON tb_local_runner_task (runner_id, status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_local_runner_task_workspace
    ON tb_local_runner_task (workspace_id, created_at);

CREATE TABLE IF NOT EXISTS tb_local_runner_task_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id VARCHAR(128) NOT NULL,
    runner_id VARCHAR(128),
    sequence_no BIGINT NOT NULL,
    level VARCHAR(32) NOT NULL DEFAULT 'INFO',
    message TEXT,
    step_id VARCHAR(128),
    data_json LONGTEXT,
    logged_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_local_runner_task_log_sequence
    ON tb_local_runner_task_log (run_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_local_runner_task_log_run
    ON tb_local_runner_task_log (run_id, logged_at);
