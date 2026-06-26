ALTER TABLE tb_mock_call_log
    ADD COLUMN IF NOT EXISTS response_headers_json LONGTEXT;

ALTER TABLE tb_mock_call_log
    ADD COLUMN IF NOT EXISTS response_body LONGTEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uk_mock_application_workspace_code
    ON tb_mock_application (workspace_id, app_code);
