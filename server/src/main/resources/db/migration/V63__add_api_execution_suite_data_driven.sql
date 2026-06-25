ALTER TABLE tb_api_execution_suite ADD COLUMN IF NOT EXISTS data_driven_enabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE tb_api_execution_suite ADD COLUMN IF NOT EXISTS data_file_id BIGINT;
ALTER TABLE tb_api_execution_suite ADD COLUMN IF NOT EXISTS data_file_name_snapshot VARCHAR(255);
ALTER TABLE tb_api_execution_suite ADD COLUMN IF NOT EXISTS case_desc_column VARCHAR(255);
ALTER TABLE tb_api_execution_suite ADD COLUMN IF NOT EXISTS data_failure_strategy VARCHAR(32) NOT NULL DEFAULT 'STOP_ON_ROW_FAILURE';
