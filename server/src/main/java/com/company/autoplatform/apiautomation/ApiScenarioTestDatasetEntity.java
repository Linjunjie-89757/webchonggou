package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_api_scenario_test_dataset")
public class ApiScenarioTestDatasetEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("scenario_id")
    private Long scenarioId;

    @TableField("dataset_name")
    private String datasetName;

    @TableField("enabled")
    private Boolean enabled;

    @TableField("source_type")
    private String sourceType;

    @TableField("source_file_id")
    private Long sourceFileId;

    @TableField("case_desc_column")
    private String caseDescColumn;

    @TableField("row_count")
    private Integer rowCount;

    @TableField("column_json")
    private String columnJson;

    @TableField("row_json")
    private String rowJson;
}
