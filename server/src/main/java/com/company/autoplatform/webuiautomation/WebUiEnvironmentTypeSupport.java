package com.company.autoplatform.webuiautomation;

import java.util.Set;

final class WebUiEnvironmentTypeSupport {

    private static final Set<String> WEB_UI_USABLE_ENV_TYPES = Set.of("WEB_UI", "TEST", "STAGING", "PROD", "SANDBOX");

    private WebUiEnvironmentTypeSupport() {
    }

    static boolean isWebUiUsable(String envType) {
        return envType != null && WEB_UI_USABLE_ENV_TYPES.contains(envType.trim().toUpperCase());
    }

    static Set<String> webUiUsableEnvTypes() {
        return WEB_UI_USABLE_ENV_TYPES;
    }
}
