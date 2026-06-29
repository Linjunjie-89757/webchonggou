package com.company.autoplatform.apiautomation;

import com.company.autoplatform.common.NotFoundException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.company.autoplatform.apiautomation.ApiAutomationFormatSupport.*;
import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;

final class ApiLocalRunnerPayloadSupport {

    private static final String SCENARIO_RESOURCE_TYPE_CASE = "CASE";
    private static final String SCENARIO_STEP_API_CASE = "API_CASE";
    private static final String SCENARIO_STEP_CUSTOM_REQUEST = "CUSTOM_REQUEST";
    private static final String SCENARIO_STEP_REF_REF = "REF";

    private ApiLocalRunnerPayloadSupport() {
    }

    static List<Map<String, Object>> buildScenarioSteps(
            List<ApiScenarioStepInput> steps,
            boolean continueOnFailure,
            ApiDefinitionCaseMapper caseMapper
    ) {
        List<Map<String, Object>> values = new ArrayList<>();
        int index = 0;
        for (ApiScenarioStepInput step : defaultList(steps)) {
            if (step == null || Boolean.FALSE.equals(step.enabled())) {
                continue;
            }
            Map<String, Object> value = new LinkedHashMap<>();
            String stepId = blankToFallback(step.id(), "api-step-" + (++index));
            String stepType = normalizeScenarioStepType(step);
            value.put("stepId", stepId);
            value.put("id", stepId);
            value.put("name", blankToFallback(step.stepName(), stepId));
            value.put("stepName", blankToFallback(step.stepName(), stepId));
            value.put("type", stepType);
            value.put("stepType", stepType);
            value.put("enabled", true);
            value.put("continueOnFailure", continueOnFailure);
            value.put("caseSnapshot", buildCaseSnapshot(step, stepType, caseMapper));
            values.add(value);
        }
        return values;
    }

    private static String normalizeScenarioStepType(ApiScenarioStepInput step) {
        String rawType = blankToNull(step.stepType());
        if (rawType == null) {
            String resourceType = blankToFallback(step.resourceType(), "").toUpperCase();
            rawType = SCENARIO_RESOURCE_TYPE_CASE.equals(resourceType) ? SCENARIO_STEP_API_CASE : SCENARIO_STEP_CUSTOM_REQUEST;
        }
        return rawType.trim().toUpperCase();
    }

    private static Map<String, Object> buildCaseSnapshot(
            ApiScenarioStepInput step,
            String stepType,
            ApiDefinitionCaseMapper caseMapper
    ) {
        if (SCENARIO_STEP_API_CASE.equals(stepType)
                && SCENARIO_STEP_REF_REF.equalsIgnoreCase(blankToFallback(step.refType(), SCENARIO_STEP_REF_REF))) {
            ApiDefinitionCaseEntity apiCase = caseMapper.selectById(step.resourceId());
            if (apiCase == null) {
                throw new NotFoundException("API case not found");
            }
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("caseId", apiCase.getId());
            value.put("caseName", apiCase.getCaseName());
            value.put("definitionId", apiCase.getDefinitionId());
            value.put("request", buildRequest(readCaseRequestConfig(apiCase)));
            value.put("assertions", buildAssertions(readAssertions(apiCase.getAssertionsJson())));
            value.put("preScript", buildScript(readProcessorsJson(apiCase.getPreprocessorsJson())));
            value.put("postScript", buildScript(readProcessorsJson(apiCase.getPostprocessorsJson())));
            return value;
        }

        Map<String, Object> value = new LinkedHashMap<>();
        value.put("caseId", step.resourceId());
        value.put("caseName", blankToFallback(step.stepName(), "Local API Step"));
        value.put("request", buildRequest(step.requestConfig()));
        value.put("assertions", buildAssertions(step.assertions()));
        value.put("preScript", buildScript(step.preProcessors()));
        value.put("postScript", buildScript(step.postProcessors()));
        return value;
    }

    private static ApiRequestConfigInput readCaseRequestConfig(ApiDefinitionCaseEntity apiCase) {
        return ApiAutomationJsonSupport.read(
                apiCase.getRequestJson(),
                ApiRequestConfigInput.class,
                new ApiRequestConfigInput("GET", "/", 30000, List.of(), List.of(), List.of(),
                        new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), emptyAuthConfig())
        );
    }

    private static Map<String, Object> buildRequest(ApiRequestConfigInput config) {
        ApiRequestConfigInput safeConfig = config == null
                ? new ApiRequestConfigInput("GET", "/", 30000, List.of(), List.of(), List.of(),
                new ApiRequestBodyInput("NONE", null, List.of(), null, null, null), emptyAuthConfig())
                : config;
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("method", blankToFallback(safeConfig.method(), "GET").toUpperCase());
        value.put("url", buildRequestUrl(safeConfig.path()));
        value.put("queryParams", buildKeyValueItems(safeConfig.queryParams()));
        value.put("headers", buildKeyValueItems(safeConfig.headers()));
        value.put("cookies", buildKeyValueItems(safeConfig.cookies()));
        value.put("body", buildRequestBody(safeConfig.body()));
        return value;
    }

    private static String buildRequestUrl(String path) {
        String value = blankToFallback(path, "/");
        if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("{{baseUrl}}")) {
            return value;
        }
        return value.startsWith("/") ? "{{baseUrl}}" + value : "{{baseUrl}}/" + value;
    }

    private static List<Map<String, Object>> buildKeyValueItems(List<ApiKeyValueInput> items) {
        return defaultList(items).stream()
                .filter(item -> item != null && !Boolean.FALSE.equals(item.enabled()) && blankToNull(item.key()) != null)
                .map(item -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("name", item.key().trim());
                    value.put("key", item.key().trim());
                    value.put("value", Optional.ofNullable(item.value()).orElse(""));
                    value.put("enabled", true);
                    return value;
                })
                .toList();
    }

    private static String buildRequestBody(ApiRequestBodyInput body) {
        if (body == null) {
            return null;
        }
        String type = blankToFallback(body.type(), "NONE").toUpperCase();
        if ("RAW_JSON".equals(type) || "RAW_TEXT".equals(type) || "RAW_XML".equals(type)) {
            return Optional.ofNullable(body.rawText()).orElse("");
        }
        return null;
    }

    private static List<Map<String, Object>> buildAssertions(List<ApiAssertionInput> assertions) {
        return defaultList(assertions).stream()
                .filter(assertion -> assertion != null && !Boolean.FALSE.equals(assertion.enabled()))
                .map(assertion -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    String type = blankToFallback(firstNonBlank(assertion.assertionType(), assertion.type()), "STATUS_CODE").toUpperCase();
                    value.put("assertionId", blankToFallback(assertion.id(), "assertion"));
                    value.put("id", blankToFallback(assertion.id(), "assertion"));
                    value.put("type", normalizeAssertionType(type, assertion.subject()));
                    value.put("expected", Optional.ofNullable(assertion.expectedValue()).orElse(""));
                    value.put("expectedValue", Optional.ofNullable(assertion.expectedValue()).orElse(""));
                    value.put("expression", blankToNull(assertion.condition()));
                    value.put("name", blankToNull(assertion.name()));
                    value.put("enabled", true);
                    return value;
                })
                .toList();
    }

    private static String normalizeAssertionType(String type, String subject) {
        if ("STATUS_CODE".equals(type)
                || "BODY_CONTAINS".equals(type)
                || "HEADER_EQUALS".equals(type)
                || "JSON_EQUALS".equals(type)
                || "RESPONSE_TIME_LESS_THAN".equals(type)) {
            return type;
        }
        String normalizedSubject = blankToFallback(subject, "").toUpperCase();
        if ("STATUS".equals(normalizedSubject) || "STATUS_CODE".equals(normalizedSubject)) {
            return "STATUS_CODE";
        }
        return type;
    }

    private static String buildScript(List<ApiProcessorInput> processors) {
        return defaultList(processors).stream()
                .filter(processor -> processor != null && !Boolean.FALSE.equals(processor.enabled()))
                .filter(processor -> "SCRIPT".equalsIgnoreCase(blankToFallback(processor.processorType(), "")))
                .filter(processor -> {
                    String language = blankToFallback(processor.scriptLanguage(), "JAVASCRIPT");
                    return "JAVASCRIPT".equalsIgnoreCase(language) || "JS".equalsIgnoreCase(language);
                })
                .map(ApiProcessorInput::script)
                .filter(script -> script != null && !script.isBlank())
                .collect(java.util.stream.Collectors.joining("\n"));
    }
}
