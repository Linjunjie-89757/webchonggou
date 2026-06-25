ALTER TABLE tb_web_ui_element_collect_task
    ADD COLUMN IF NOT EXISTS filter_summary_json CLOB;
