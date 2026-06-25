package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_api_data_file")
public class ApiDataFileEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("file_name")
    private String fileName;

    @TableField("original_file_name")
    private String originalFileName;

    @TableField("file_type")
    private String fileType;

    @TableField("encoding")
    private String encoding;

    @TableField("delimiter_char")
    private String delimiterChar;

    @TableField("ignore_first_line")
    private Boolean ignoreFirstLine;

    @TableField("case_desc_column")
    private String caseDescColumn;

    @TableField("row_count")
    private Integer rowCount;

    @TableField("column_json")
    private String columnJson;

    @TableField("content_text")
    private String contentText;
}
