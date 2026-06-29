ALTER TABLE tb_web_ui_element
    ADD COLUMN IF NOT EXISTS locator_context_json TEXT;

ALTER TABLE tb_web_ui_case_step
    ADD COLUMN IF NOT EXISTS locator_context_json TEXT;

ALTER TABLE tb_web_ui_case_template_step
    ADD COLUMN IF NOT EXISTS locator_context_json TEXT;
