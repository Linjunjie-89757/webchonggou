package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_param_set_change_history")
public class ParamSetChangeHistoryEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("param_set_id")
    private Long paramSetId;

    @TableField("param_name")
    private String paramName;

    @TableField("change_type")
    private String changeType;

    @TableField("before_json")
    private String beforeJson;

    @TableField("after_json")
    private String afterJson;

    @TableField("changed_fields")
    private String changedFields;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("operator_name")
    private String operatorName;
}
