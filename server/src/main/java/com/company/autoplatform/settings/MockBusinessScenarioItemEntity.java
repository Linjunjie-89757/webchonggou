package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_mock_business_scenario_item")
public class MockBusinessScenarioItemEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("business_scenario_id")
    private Long businessScenarioId;

    @TableField("app_id")
    private Long appId;

    @TableField("endpoint_id")
    private Long endpointId;

    @TableField("scenario_id")
    private Long scenarioId;

    @TableField("sort_order")
    private Integer sortOrder;

    private Integer status;
}
