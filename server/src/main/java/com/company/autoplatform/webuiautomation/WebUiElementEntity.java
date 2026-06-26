package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_web_ui_element")
public class WebUiElementEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("page_id")
    private Long pageId;

    @TableField("group_id")
    private Long groupId;

    @TableField("page_name")
    private String pageName;

    @TableField("group_name")
    private String groupName;

    @TableField("element_name")
    private String elementName;

    @TableField("locator_type")
    private String locatorType;

    @TableField("locator_value")
    private String locatorValue;

    private String description;

    private String status;

    @TableField("last_validate_result")
    private String lastValidateResult;

    @TableField("last_validate_at")
    private LocalDateTime lastValidateAt;

    @TableField("last_validate_message")
    private String lastValidateMessage;

    @TableField("last_match_count")
    private Integer lastMatchCount;

    @TableField("last_local_runner_run_id")
    private String lastLocalRunnerRunId;

    @TableField("collect_task_id")
    private Long collectTaskId;

    @TableField("collect_source")
    private String collectSource;

    @TableField("collect_confidence")
    private Integer collectConfidence;

    @TableField("collect_validation_status")
    private String collectValidationStatus;

    @TableField("collect_match_count")
    private Integer collectMatchCount;

    @TableField("collect_validation_message")
    private String collectValidationMessage;

    @TableField("collect_screenshot_base64")
    private String collectScreenshotBase64;
}
