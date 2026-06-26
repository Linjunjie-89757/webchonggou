package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_local_runner_task")
public class LocalRunnerTaskEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("workspace_code")
    private String workspaceCode;

    @TableField("run_id")
    private String runId;

    @TableField("task_type")
    private String taskType;

    @TableField("execution_location")
    private String executionLocation;

    @TableField("execution_token")
    private String executionToken;

    @TableField("runner_id")
    private String runnerId;

    @TableField("user_id")
    private String userId;

    @TableField("protocol_version")
    private String protocolVersion;

    private String priority;

    @TableField("resource_cost")
    private Integer resourceCost;

    private String status;

    @TableField("current_stage")
    private String currentStage;

    @TableField("progress_current")
    private Integer progressCurrent;

    @TableField("progress_total")
    private Integer progressTotal;

    @TableField("progress_percent")
    private Integer progressPercent;

    @TableField("status_message")
    private String statusMessage;

    @TableField("error_message")
    private String errorMessage;

    @TableField("timeout_policy_json")
    private String timeoutPolicyJson;

    @TableField("environment_snapshot_json")
    private String environmentSnapshotJson;

    @TableField("variable_snapshot_json")
    private String variableSnapshotJson;

    @TableField("script_snapshot_json")
    private String scriptSnapshotJson;

    @TableField("artifact_refs_json")
    private String artifactRefsJson;

    @TableField("masking_rules_json")
    private String maskingRulesJson;

    @TableField("screenshot_policy_json")
    private String screenshotPolicyJson;

    @TableField("payload_json")
    private String payloadJson;

    @TableField("result_json")
    private String resultJson;

    @TableField("deadline_at")
    private LocalDateTime deadlineAt;

    @TableField("assigned_at")
    private LocalDateTime assignedAt;

    @TableField("started_at")
    private LocalDateTime startedAt;

    @TableField("completed_at")
    private LocalDateTime completedAt;

    @TableField("last_reported_at")
    private LocalDateTime lastReportedAt;
}
