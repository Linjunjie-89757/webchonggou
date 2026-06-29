ALTER TABLE tb_web_ui_element
    ADD COLUMN locator_context_json TEXT NULL;

ALTER TABLE tb_web_ui_case_step
    ADD COLUMN locator_context_json TEXT NULL;

ALTER TABLE tb_web_ui_case_template_step
    ADD COLUMN locator_context_json TEXT NULL;
