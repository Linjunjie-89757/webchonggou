package com.company.autoplatform.runner;

import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

import static com.company.autoplatform.runner.LocalRunnerModels.RunnerNodeSummaryResponse;

@RestController
@RequestMapping("/api/local-runner/nodes")
public class LocalRunnerNodeController {

    private final LocalRunnerService localRunnerService;

    public LocalRunnerNodeController(LocalRunnerService localRunnerService) {
        this.localRunnerService = localRunnerService;
    }

    @GetMapping
    public ApiResponse<List<RunnerNodeSummaryResponse>> listNodes() {
        CurrentUserContext.require();
        return ApiResponse.ok(localRunnerService.listRunnerNodes(Duration.ofMinutes(2)));
    }
}
