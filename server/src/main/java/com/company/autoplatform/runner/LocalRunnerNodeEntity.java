package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_local_runner_node")
public class LocalRunnerNodeEntity extends BaseEntity {

    @TableField("runner_id")
    private String runnerId;

    @TableField("install_id")
    private String installId;

    @TableField("runner_token")
    private String runnerToken;

    @TableField("runner_name")
    private String runnerName;

    @TableField("runner_version")
    private String runnerVersion;

    @TableField("protocol_version")
    private String protocolVersion;

    @TableField("capabilities_json")
    private String capabilitiesJson;

    @TableField("machine_hint_json")
    private String machineHintJson;

    @TableField("resource_json")
    private String resourceJson;

    @TableField("browser_json")
    private String browserJson;

    @TableField("session_json")
    private String sessionJson;

    private String status;

    @TableField("last_heartbeat_at")
    private LocalDateTime lastHeartbeatAt;
}
