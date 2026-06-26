package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_api_execution_suite_run_history")
public class ApiExecutionSuiteRunHistoryEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("suite_id")
    private Long suiteId;

    @TableField("suite_name")
    private String suiteName;

    @TableField("module_id")
    private Long moduleId;

    @TableField("module_name")
    private String moduleName;

    @TableField("priority")
    private String priority;

    @TableField("report_id")
    private Long reportId;

    @TableField("result")
    private String result;

    @TableField("failure_summary")
    private String failureSummary;

    @TableField("total_count")
    private Integer totalCount;

    @TableField("success_count")
    private Integer successCount;

    @TableField("failed_count")
    private Integer failedCount;

    @TableField("skipped_count")
    private Integer skippedCount;

    @TableField("duration_ms")
    private Long durationMs;

    @TableField("environment_id")
    private Long environmentId;

    @TableField("variable_set_id")
    private Long variableSetId;

    @TableField("run_mode")
    private String runMode;

    @TableField("run_on")
    private String runOn;

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

    @TableField("data_file_name")
    private String dataFileName;

    @TableField("data_row_count")
    private Integer dataRowCount;

    @TableField("data_iteration_json")
    private String dataIterationJson;

    @TableField("branch_name")
    private String branchName;

    @TableField("trigger_source")
    private String triggerSource;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("operator_name")
    private String operatorName;

    @TableField("detail_json")
    private String detailJson;

    @TableField("item_snapshot_json")
    private String itemSnapshotJson;

    @TableField("context_snapshot_json")
    private String contextSnapshotJson;
}
