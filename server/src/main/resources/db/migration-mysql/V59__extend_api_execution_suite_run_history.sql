SET @add_api_suite_history_module_id = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'module_id'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN module_id BIGINT'
    )
);
PREPARE stmt FROM @add_api_suite_history_module_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_module_name = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'module_name'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN module_name VARCHAR(255)'
    )
);
PREPARE stmt FROM @add_api_suite_history_module_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_priority = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'priority'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN priority VARCHAR(16)'
    )
);
PREPARE stmt FROM @add_api_suite_history_priority;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_run_mode = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'run_mode'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN run_mode VARCHAR(32)'
    )
);
PREPARE stmt FROM @add_api_suite_history_run_mode;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_run_on = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'run_on'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN run_on VARCHAR(32)'
    )
);
PREPARE stmt FROM @add_api_suite_history_run_on;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_continue_on_failure = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'continue_on_failure'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN continue_on_failure TINYINT(1) NOT NULL DEFAULT 0'
    )
);
PREPARE stmt FROM @add_api_suite_history_continue_on_failure;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_global_timeout_ms = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'global_timeout_ms'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN global_timeout_ms INT NOT NULL DEFAULT 300000'
    )
);
PREPARE stmt FROM @add_api_suite_history_global_timeout_ms;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_step_failure_retry_count = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'step_failure_retry_count'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN step_failure_retry_count INT NOT NULL DEFAULT 0'
    )
);
PREPARE stmt FROM @add_api_suite_history_step_failure_retry_count;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_default_step_wait_ms = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'default_step_wait_ms'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN default_step_wait_ms INT NOT NULL DEFAULT 0'
    )
);
PREPARE stmt FROM @add_api_suite_history_default_step_wait_ms;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_branch_name = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'branch_name'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN branch_name VARCHAR(255)'
    )
);
PREPARE stmt FROM @add_api_suite_history_branch_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_trigger_source = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'trigger_source'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN trigger_source VARCHAR(255)'
    )
);
PREPARE stmt FROM @add_api_suite_history_trigger_source;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_api_suite_history_item_snapshot_json = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_api_execution_suite_run_history'
              AND column_name = 'item_snapshot_json'
        ),
        'SELECT 1',
        'ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN item_snapshot_json LONGTEXT'
    )
);
PREPARE stmt FROM @add_api_suite_history_item_snapshot_json;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
