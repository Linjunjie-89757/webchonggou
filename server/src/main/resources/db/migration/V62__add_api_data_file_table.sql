CREATE TABLE IF NOT EXISTS tb_api_data_file (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255),
    file_type VARCHAR(32) NOT NULL DEFAULT 'CSV',
    encoding VARCHAR(64) NOT NULL DEFAULT 'UTF-8',
    delimiter_char VARCHAR(16) NOT NULL DEFAULT ',',
    ignore_first_line TINYINT(1) NOT NULL DEFAULT 0,
    case_desc_column VARCHAR(255),
    row_count INT NOT NULL DEFAULT 0,
    column_json LONGTEXT,
    content_text LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
