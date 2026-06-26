ALTER TABLE tb_api_definition_case_run_history
    ADD COLUMN context_snapshot_json LONGTEXT NULL;

ALTER TABLE tb_api_scenario_run_history
    ADD COLUMN context_snapshot_json LONGTEXT NULL;

ALTER TABLE tb_api_execution_suite_run_history
    ADD COLUMN context_snapshot_json LONGTEXT NULL;
