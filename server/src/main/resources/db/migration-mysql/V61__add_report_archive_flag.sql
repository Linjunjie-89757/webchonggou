ALTER TABLE tb_exec_report ADD COLUMN archived TINYINT(1) DEFAULT 0;

UPDATE tb_exec_report SET archived = 0 WHERE archived IS NULL;
