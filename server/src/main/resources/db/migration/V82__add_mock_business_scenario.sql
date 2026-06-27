CREATE TABLE IF NOT EXISTS tb_mock_business_scenario (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    app_id BIGINT NOT NULL,
    scenario_name VARCHAR(255) NOT NULL,
    description VARCHAR(1000),
    variables_json LONGTEXT,
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_mock_business_scenario_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    business_scenario_id BIGINT NOT NULL,
    app_id BIGINT NOT NULL,
    endpoint_id BIGINT NOT NULL,
    scenario_id BIGINT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mock_business_scenario_app
    ON tb_mock_business_scenario (app_id, status);

CREATE INDEX IF NOT EXISTS idx_mock_business_scenario_workspace
    ON tb_mock_business_scenario (workspace_id);

CREATE INDEX IF NOT EXISTS idx_mock_business_scenario_item_scenario
    ON tb_mock_business_scenario_item (business_scenario_id, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_mock_business_scenario_item_endpoint
    ON tb_mock_business_scenario_item (endpoint_id, scenario_id);
