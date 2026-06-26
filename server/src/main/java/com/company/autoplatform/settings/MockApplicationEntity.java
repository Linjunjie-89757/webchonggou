package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_mock_application")
public class MockApplicationEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("app_name")
    private String appName;

    @TableField("app_code")
    private String appCode;

    private String description;

    private Integer status;
}
