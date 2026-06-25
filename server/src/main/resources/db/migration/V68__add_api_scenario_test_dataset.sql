CREATE TABLE IF NOT EXISTS tb_api_scenario_test_dataset (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    scenario_id BIGINT NOT NULL,
    dataset_name VARCHAR(255) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    source_type VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    source_file_id BIGINT,
    case_desc_column VARCHAR(255),
    row_count INT NOT NULL DEFAULT 0,
    column_json LONGTEXT,
    row_json LONGTEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_scenario_test_dataset_scenario
    ON tb_api_scenario_test_dataset (scenario_id);

CREATE INDEX IF NOT EXISTS idx_api_scenario_test_dataset_workspace
    ON tb_api_scenario_test_dataset (workspace_id);
