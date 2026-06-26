package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_mock_endpoint")
public class MockEndpointEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("app_id")
    private Long appId;

    @TableField("endpoint_name")
    private String endpointName;

    @TableField("http_method")
    private String httpMethod;

    @TableField("path_pattern")
    private String pathPattern;

    private String description;

    private Integer status;
}
