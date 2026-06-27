ALTER TABLE tb_mock_call_log
    ADD COLUMN IF NOT EXISTS business_scenario_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_mock_call_log_business_scenario
    ON tb_mock_call_log (business_scenario_id, created_at);
