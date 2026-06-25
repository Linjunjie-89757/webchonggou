package com.company.autoplatform.webuiautomation;

import java.util.List;

import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.CollectWebUiElementsRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectCandidate;

@FunctionalInterface
interface WebUiElementAiEnhancer {

    Result enhance(List<WebUiElementCollectCandidate> candidates, CollectWebUiElementsRequest request, String source);

    static WebUiElementAiEnhancer noop() {
        return (candidates, request, source) -> Result.fallback(candidates, "AI 增强未启用");
    }

    record Result(
            List<WebUiElementCollectCandidate> candidates,
            boolean enhanced,
            String message,
            String fallbackReason
    ) {
        static Result enhanced(List<WebUiElementCollectCandidate> candidates, String message) {
            return new Result(candidates, true, message, null);
        }

        static Result fallback(List<WebUiElementCollectCandidate> candidates, String fallbackReason) {
            return new Result(candidates, false, "已生成规则候选元素，AI 增强未启用或失败", fallbackReason);
        }
    }
}
