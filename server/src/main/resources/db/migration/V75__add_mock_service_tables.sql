CREATE TABLE IF NOT EXISTS tb_mock_application (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    app_code VARCHAR(128) NOT NULL,
    description VARCHAR(1000),
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_mock_endpoint (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    app_id BIGINT NOT NULL,
    endpoint_name VARCHAR(255) NOT NULL,
    http_method VARCHAR(16) NOT NULL,
    path_pattern VARCHAR(500) NOT NULL,
    description VARCHAR(1000),
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_mock_scenario (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    app_id BIGINT NOT NULL,
    endpoint_id BIGINT NOT NULL,
    scenario_name VARCHAR(255) NOT NULL,
    priority INT NOT NULL DEFAULT 100,
    match_json LONGTEXT,
    response_status INT NOT NULL DEFAULT 200,
    response_headers_json LONGTEXT,
    response_body LONGTEXT,
    response_delay_ms INT NOT NULL DEFAULT 0,
    variables_json LONGTEXT,
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_mock_call_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    app_id BIGINT,
    endpoint_id BIGINT,
    scenario_id BIGINT,
    http_method VARCHAR(16) NOT NULL,
    request_path VARCHAR(500) NOT NULL,
    request_headers_json LONGTEXT,
    request_body LONGTEXT,
    response_status INT,
    matched TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mock_application_workspace
    ON tb_mock_application (workspace_id);
CREATE INDEX IF NOT EXISTS idx_mock_application_code
    ON tb_mock_application (app_code);
CREATE INDEX IF NOT EXISTS idx_mock_endpoint_app
    ON tb_mock_endpoint (app_id);
CREATE INDEX IF NOT EXISTS idx_mock_endpoint_path
    ON tb_mock_endpoint (http_method, path_pattern);
CREATE INDEX IF NOT EXISTS idx_mock_scenario_endpoint
    ON tb_mock_scenario (endpoint_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_mock_call_log_workspace_created
    ON tb_mock_call_log (workspace_id, created_at);
