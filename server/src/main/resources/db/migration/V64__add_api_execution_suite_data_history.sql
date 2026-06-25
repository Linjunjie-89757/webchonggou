ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN IF NOT EXISTS data_driven_enabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN IF NOT EXISTS data_file_id BIGINT;
ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN IF NOT EXISTS data_file_name VARCHAR(255);
ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN IF NOT EXISTS data_row_count INT NOT NULL DEFAULT 0;
ALTER TABLE tb_api_execution_suite_run_history ADD COLUMN IF NOT EXISTS data_iteration_json LONGTEXT;
