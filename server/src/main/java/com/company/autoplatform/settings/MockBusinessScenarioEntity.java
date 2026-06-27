package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_mock_business_scenario")
public class MockBusinessScenarioEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("app_id")
    private Long appId;

    @TableField("scenario_name")
    private String scenarioName;

    private String description;

    @TableField("variables_json")
    private String variablesJson;

    private Integer status;
}
