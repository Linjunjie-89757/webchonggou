ALTER TABLE tb_mock_call_log
    ADD COLUMN response_headers_json LONGTEXT NULL;

ALTER TABLE tb_mock_call_log
    ADD COLUMN response_body LONGTEXT NULL;

CREATE UNIQUE INDEX uk_mock_application_workspace_code
    ON tb_mock_application (workspace_id, app_code);
