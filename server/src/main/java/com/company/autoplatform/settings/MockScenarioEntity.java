package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_mock_scenario")
public class MockScenarioEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("app_id")
    private Long appId;

    @TableField("endpoint_id")
    private Long endpointId;

    @TableField("scenario_name")
    private String scenarioName;

    private Integer priority;

    @TableField("match_json")
    private String matchJson;

    @TableField("response_status")
    private Integer responseStatus;

    @TableField("response_headers_json")
    private String responseHeadersJson;

    @TableField("response_body")
    private String responseBody;

    @TableField("response_delay_ms")
    private Integer responseDelayMs;

    @TableField("variables_json")
    private String variablesJson;

    private Integer status;
}
