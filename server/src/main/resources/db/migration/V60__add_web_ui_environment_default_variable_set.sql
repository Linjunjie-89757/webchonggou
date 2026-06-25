ALTER TABLE tb_web_ui_environment
    ADD COLUMN IF NOT EXISTS default_variable_set_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_web_ui_environment_default_variable_set
    ON tb_web_ui_environment(default_variable_set_id);
