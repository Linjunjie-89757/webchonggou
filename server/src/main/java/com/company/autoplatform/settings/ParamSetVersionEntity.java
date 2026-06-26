package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_param_set_version")
public class ParamSetVersionEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("param_set_id")
    private Long paramSetId;

    @TableField("version_no")
    private Integer versionNo;

    @TableField("param_type")
    private String paramType;

    @TableField("param_name")
    private String paramName;

    @TableField("content_json")
    private String contentJson;

    private Integer status;

    @TableField("change_type")
    private String changeType;

    @TableField("changed_fields")
    private String changedFields;

    @TableField("source_version_id")
    private Long sourceVersionId;

    @TableField("operator_id")
    private Long operatorId;

    @TableField("operator_name")
    private String operatorName;

    @TableField("is_latest")
    private Boolean latest;
}
