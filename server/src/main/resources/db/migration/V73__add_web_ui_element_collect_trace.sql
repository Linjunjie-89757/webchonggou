ALTER TABLE tb_web_ui_element
    ADD COLUMN collect_task_id BIGINT NULL;

ALTER TABLE tb_web_ui_element
    ADD COLUMN collect_source VARCHAR(64) NULL;

ALTER TABLE tb_web_ui_element
    ADD COLUMN collect_confidence INT NULL;

ALTER TABLE tb_web_ui_element
    ADD COLUMN collect_validation_status VARCHAR(32) NULL;

ALTER TABLE tb_web_ui_element
    ADD COLUMN collect_match_count INT NULL;

ALTER TABLE tb_web_ui_element
    ADD COLUMN collect_validation_message CLOB NULL;

ALTER TABLE tb_web_ui_element
    ADD COLUMN collect_screenshot_base64 CLOB NULL;

CREATE INDEX idx_web_ui_element_collect_task ON tb_web_ui_element(collect_task_id);
