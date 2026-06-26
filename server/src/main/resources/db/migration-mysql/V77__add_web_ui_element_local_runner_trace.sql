ALTER TABLE tb_web_ui_element
    ADD COLUMN last_local_runner_run_id VARCHAR(128) NULL;

CREATE INDEX idx_web_ui_element_local_runner_run ON tb_web_ui_element(last_local_runner_run_id);
