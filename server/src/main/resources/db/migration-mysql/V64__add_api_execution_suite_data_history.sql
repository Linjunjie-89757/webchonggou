SET @add_api_suite_history_data_driven_enabled = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'data_driven_enabled'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN data_driven_enabled TINYINT(1) NOT NULL DEFAULT 0'
    )
);
PREPARE stmt FROM @add_api_suite_history_data_driven_enabled;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_data_file_id = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'data_file_id'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN data_file_id BIGINT'
    )
);
PREPARE stmt FROM @add_api_suite_history_data_file_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_data_file_name = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'data_file_name'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN data_file_name VARCHAR(255)'
    )
);
PREPARE stmt FROM @add_api_suite_history_data_file_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_data_row_count = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'data_row_count'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN data_row_count INT NOT NULL DEFAULT 0'
    )
);
PREPARE stmt FROM @add_api_suite_history_data_row_count;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_data_iteration_json = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'data_iteration_json'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN data_iteration_json LONGTEXT'
    )
);
PREPARE stmt FROM @add_api_suite_history_data_iteration_json;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
