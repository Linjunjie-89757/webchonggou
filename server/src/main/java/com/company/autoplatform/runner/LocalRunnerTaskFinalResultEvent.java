package com.company.autoplatform.runner;

import java.util.Map;

public record LocalRunnerTaskFinalResultEvent(
        String runId,
        String taskType,
        String status,
        Long workspaceId,
        String workspaceCode,
        String runnerId,
        Map<String, Object> payload,
        Map<String, Object> result
) {
}
