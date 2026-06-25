package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_web_ui_element_collect_task")
public class WebUiElementCollectTaskEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("runner_id")
    private String runnerId;

    @TableField("session_id")
    private String sessionId;

    private String status;

    private String source;

    @TableField("actual_url")
    private String actualUrl;

    @TableField("page_title")
    private String pageTitle;

    @TableField("module_id")
    private Long moduleId;

    @TableField("page_id")
    private Long pageId;

    @TableField("page_name")
    private String pageName;

    @TableField("ai_model_config_id")
    private Long aiModelConfigId;

    @TableField("ai_model_name")
    private String aiModelName;

    @TableField("raw_count")
    private Integer rawCount;

    @TableField("final_count")
    private Integer finalCount;

    @TableField("snapshot_json")
    private String snapshotJson;

    @TableField("candidates_json")
    private String candidatesJson;

    @TableField("filter_summary_json")
    private String filterSummaryJson;

    @TableField("filter_details_json")
    private String filterDetailsJson;

    @TableField("collect_message")
    private String collectMessage;

    @TableField("global_screenshot_base64")
    private String globalScreenshotBase64;

    @TableField("completed_at")
    private LocalDateTime completedAt;

    @TableField("error_message")
    private String errorMessage;
}
