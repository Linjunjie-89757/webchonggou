ALTER TABLE tb_exec_report ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

UPDATE tb_exec_report SET archived = FALSE WHERE archived IS NULL;
