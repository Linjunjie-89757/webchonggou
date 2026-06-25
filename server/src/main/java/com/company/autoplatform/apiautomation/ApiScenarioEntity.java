package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_api_scenario")
public class ApiScenarioEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("scenario_name")
    private String scenarioName;

    @TableField("directory_name")
    private String directoryName;

    @TableField("module_id")
    private Long moduleId;

    private String priority;

    private String status;

    private String description;

    @TableField("tags_json")
    private String tagsJson;

    @TableField("steps_json")
    private String stepsJson;

    @TableField("scenario_assertions_json")
    private String scenarioAssertionsJson;

    @TableField("scenario_variables_json")
    private String scenarioVariablesJson;

    @TableField("default_env_id")
    private Long defaultEnvId;

    @TableField("variable_set_id")
    private Long variableSetId;

    @TableField("continue_on_failure")
    private Boolean continueOnFailure;

    @TableField("global_timeout_ms")
    private Integer globalTimeoutMs;

    @TableField("step_failure_retry_count")
    private Integer stepFailureRetryCount;

    @TableField("default_step_wait_ms")
    private Integer defaultStepWaitMs;

    @TableField("data_driven_enabled")
    private Boolean dataDrivenEnabled;

    @TableField("data_file_id")
    private Long dataFileId;

    @TableField("data_file_name_snapshot")
    private String dataFileNameSnapshot;

    @TableField("case_desc_column")
    private String caseDescColumn;

    @TableField("data_failure_strategy")
    private String dataFailureStrategy;

    @TableField("related_case_id")
    private Long relatedCaseId;

    @TableField("last_run_result")
    private String lastRunResult;

    @TableField("last_run_at")
    private LocalDateTime lastRunAt;
}
