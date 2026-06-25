ALTER TABLE tb_web_ui_environment
    ADD COLUMN default_variable_set_id BIGINT NULL;

CREATE INDEX idx_web_ui_environment_default_variable_set
    ON tb_web_ui_environment(default_variable_set_id);
