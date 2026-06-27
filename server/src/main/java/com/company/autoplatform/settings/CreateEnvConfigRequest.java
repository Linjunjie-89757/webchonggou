package com.company.autoplatform.settings;

import jakarta.validation.constraints.NotBlank;

public record CreateEnvConfigRequest(
        String workspaceCode,
        String envType,
        @NotBlank(message = "环境名称不能为空") String envName,
        @NotBlank(message = "基础地址不能为空") String baseUrl,
        String configJson
) {
}
