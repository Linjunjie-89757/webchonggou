package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.common.ApiResponse;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.LocalRunnerCollectValidationCommandRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.LocalRunnerCollectValidationCommandResponse;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.LocalRunnerCollectValidationResultRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectTaskResponse;

@RestController
@RequestMapping("/api/public/automation/web/element-collect-tasks")
public class WebUiPublicElementCollectController {

    private final WebUiAutomationService webUiAutomationService;

    public WebUiPublicElementCollectController(WebUiAutomationService webUiAutomationService) {
        this.webUiAutomationService = webUiAutomationService;
    }

    @PostMapping("/{taskId}/local-validation-command")
    public ApiResponse<LocalRunnerCollectValidationCommandResponse> getLocalRunnerCollectValidationCommand(
            @PathVariable Long taskId,
            @RequestBody(required = false) LocalRunnerCollectValidationCommandRequest request
    ) {
        return ApiResponse.ok(webUiAutomationService.getPublicLocalRunnerCollectValidationCommand(taskId, request));
    }

    @PostMapping("/{taskId}/local-validation-results")
    public ApiResponse<WebUiElementCollectTaskResponse> submitLocalRunnerCollectValidationResults(
            @PathVariable Long taskId,
            @RequestBody LocalRunnerCollectValidationResultRequest request
    ) {
        return ApiResponse.ok(webUiAutomationService.submitPublicLocalRunnerCollectValidationResults(taskId, request));
    }
}
