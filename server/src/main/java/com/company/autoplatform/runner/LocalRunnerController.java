package com.company.autoplatform.runner;

import com.company.autoplatform.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.company.autoplatform.runner.LocalRunnerModels.*;

@RestController
@RequestMapping("/api/public/local-runner")
public class LocalRunnerController {

    private final LocalRunnerService localRunnerService;

    public LocalRunnerController(LocalRunnerService localRunnerService) {
        this.localRunnerService = localRunnerService;
    }

    @PostMapping("/register")
    public ApiResponse<RunnerRegisterResponse> register(@Valid @RequestBody RunnerRegisterRequest request) {
        return ApiResponse.ok(localRunnerService.register(request), "Runner registered");
    }

    @PostMapping("/heartbeat")
    public ApiResponse<RunnerTaskAckResponse> heartbeat(@Valid @RequestBody RunnerHealthPayload payload) {
        return ApiResponse.ok(localRunnerService.heartbeat(payload), "Runner heartbeat accepted");
    }

    @PostMapping("/tasks/pull")
    public ApiResponse<PullRunnerTaskResponse> pullTask(@Valid @RequestBody PullRunnerTaskRequest request) {
        return ApiResponse.ok(localRunnerService.pullTask(request), "Runner task pull completed");
    }

    @PostMapping("/tasks/{runId}/status")
    public ApiResponse<RunnerTaskAckResponse> reportStatus(
            @PathVariable String runId,
            @Valid @RequestBody RunnerTaskStatusReport report
    ) {
        return ApiResponse.ok(localRunnerService.reportStatus(runId, report), "Runner task status accepted");
    }

    @PostMapping("/tasks/{runId}/logs")
    public ApiResponse<RunnerTaskAckResponse> appendLog(
            @PathVariable String runId,
            @Valid @RequestBody RunnerTaskLogReport report
    ) {
        return ApiResponse.ok(localRunnerService.appendLog(runId, report), "Runner task log accepted");
    }

    @PostMapping("/tasks/{runId}/steps")
    public ApiResponse<RunnerTaskAckResponse> reportStepResult(
            @PathVariable String runId,
            @Valid @RequestBody RunnerStepResultReport report
    ) {
        return ApiResponse.ok(localRunnerService.reportStepResult(runId, report), "Runner task step result accepted");
    }

    @PostMapping("/tasks/{runId}/result")
    public ApiResponse<RunnerTaskAckResponse> reportFinalResult(
            @PathVariable String runId,
            @Valid @RequestBody RunnerFinalResultReport report
    ) {
        return ApiResponse.ok(localRunnerService.reportFinalResult(runId, report), "Runner task result accepted");
    }
}
