package com.company.autoplatform.apiautomation;

import java.util.Set;

final class ApiEnvironmentTypeSupport {

    private static final Set<String> API_USABLE_ENV_TYPES = Set.of("API", "TEST", "STAGING", "PROD", "SANDBOX");

    private ApiEnvironmentTypeSupport() {
    }

    static boolean isApiUsable(String envType) {
        return envType != null && API_USABLE_ENV_TYPES.contains(envType.trim().toUpperCase());
    }

    static Set<String> apiUsableEnvTypes() {
        return API_USABLE_ENV_TYPES;
    }
}
