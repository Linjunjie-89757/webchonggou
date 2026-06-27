SET @add_mock_call_log_business_scenario_id = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_mock_call_log'
              AND column_name = 'business_scenario_id'
        ),
        'SELECT 1',
        'ALTER TABLE tb_mock_call_log ADD COLUMN business_scenario_id BIGINT NULL'
    )
);
PREPARE stmt FROM @add_mock_call_log_business_scenario_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @create_mock_call_log_business_scenario_idx = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_mock_call_log'
              AND index_name = 'idx_mock_call_log_business_scenario'
        ),
        'SELECT 1',
        'CREATE INDEX idx_mock_call_log_business_scenario ON tb_mock_call_log (business_scenario_id, created_at)'
    )
);
PREPARE stmt FROM @create_mock_call_log_business_scenario_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
