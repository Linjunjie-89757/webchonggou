SET @add_api_scenario_data_driven_enabled = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_scenario'
              AND column_name = 'data_driven_enabled'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_scenario ADD COLUMN data_driven_enabled TINYINT(1) NOT NULL DEFAULT 0'
    )
);
PREPARE stmt FROM @add_api_scenario_data_driven_enabled;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_scenario_data_file_id = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_scenario'
              AND column_name = 'data_file_id'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_scenario ADD COLUMN data_file_id BIGINT'
    )
);
PREPARE stmt FROM @add_api_scenario_data_file_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_scenario_data_file_name_snapshot = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_scenario'
              AND column_name = 'data_file_name_snapshot'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_scenario ADD COLUMN data_file_name_snapshot VARCHAR(255)'
    )
);
PREPARE stmt FROM @add_api_scenario_data_file_name_snapshot;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_scenario_case_desc_column = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_scenario'
              AND column_name = 'case_desc_column'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_scenario ADD COLUMN case_desc_column VARCHAR(255)'
    )
);
PREPARE stmt FROM @add_api_scenario_case_desc_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_scenario_data_failure_strategy = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_scenario'
              AND column_name = 'data_failure_strategy'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_scenario ADD COLUMN data_failure_strategy VARCHAR(32) NOT NULL DEFAULT ''STOP_ON_ROW_FAILURE'''
    )
);
PREPARE stmt FROM @add_api_scenario_data_failure_strategy;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
