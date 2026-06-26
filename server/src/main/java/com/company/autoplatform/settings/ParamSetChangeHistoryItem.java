package com.company.autoplatform.settings;

import java.time.LocalDateTime;

public record ParamSetChangeHistoryItem(
        Long id,
        String workspaceCode,
        String workspaceName,
        Long paramSetId,
        String paramName,
        String changeType,
        String beforeJson,
        String afterJson,
        String changedFields,
        Long operatorId,
        String operatorName,
        LocalDateTime createdAt
) {
}
