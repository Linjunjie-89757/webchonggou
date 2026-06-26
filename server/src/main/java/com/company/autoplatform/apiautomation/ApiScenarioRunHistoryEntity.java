package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_api_scenario_run_history")
public class ApiScenarioRunHistoryEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("scenario_id")
    private Long scenarioId;

    @TableField("scenario_name")
    private String scenarioName;

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

    @TableField("test_dataset_id")
    private Long testDatasetId;

    @TableField("test_dataset_name")
    private String testDatasetName;

    @TableField("loop_count")
    private Integer loopCount;

    @TableField("thread_count")
    private Integer threadCount;

    @TableField("data_iteration_json")
    private String dataIterationJson;

    @TableField("detail_json")
    private String detailJson;

    @TableField("context_snapshot_json")
    private String contextSnapshotJson;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("operator_name")
    private String operatorName;
}
