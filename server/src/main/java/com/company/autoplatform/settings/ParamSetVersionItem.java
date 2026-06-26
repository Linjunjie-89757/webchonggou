package com.company.autoplatform.settings;

import java.time.LocalDateTime;

public record ParamSetVersionItem(
        Long id,
        String workspaceCode,
        String workspaceName,
        Long paramSetId,
        Integer versionNo,
        String paramType,
        String paramName,
        String contentJson,
        Integer status,
        String changeType,
        String changedFields,
        Long sourceVersionId,
        Long operatorId,
        String operatorName,
        Boolean latest,
        LocalDateTime createdAt
) {
}
