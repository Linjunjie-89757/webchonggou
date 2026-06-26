package com.company.autoplatform.settings;

import java.time.LocalDateTime;
import java.util.List;

public final class ConfigReferenceModels {

    private ConfigReferenceModels() {
    }

    public record ConfigReferenceSummary(
            String resourceType,
            Long resourceId,
            String resourceName,
            Integer totalCount,
            List<ConfigReferenceItem> items
    ) {
    }

    public record ConfigReferenceItem(
            String sourceType,
            Long sourceId,
            String sourceName,
            String workspaceCode,
            String workspaceName,
            String referenceField,
            LocalDateTime updatedAt
    ) {
    }
}
