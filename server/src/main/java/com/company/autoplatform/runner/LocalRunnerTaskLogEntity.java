package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_local_runner_task_log")
public class LocalRunnerTaskLogEntity extends BaseEntity {

    @TableField("run_id")
    private String runId;

    @TableField("runner_id")
    private String runnerId;

    @TableField("sequence_no")
    private Long sequenceNo;

    private String level;

    private String message;

    @TableField("step_id")
    private String stepId;

    @TableField("data_json")
    private String dataJson;

    @TableField("logged_at")
    private LocalDateTime loggedAt;
}
