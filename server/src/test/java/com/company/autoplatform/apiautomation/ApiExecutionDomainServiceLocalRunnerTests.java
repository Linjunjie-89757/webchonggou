package com.company.autoplatform.apiautomation;

import com.company.autoplatform.runner.LocalRunnerModels.CreateRunnerTaskCommand;
import com.company.autoplatform.runner.LocalRunnerModels.RunnerTaskDetailResponse;
import com.company.autoplatform.runner.LocalRunnerService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.ApiRunRequest;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ApiExecutionDomainServiceLocalRunnerTests {

    @Test
    void runScenarioCreatesLocalRunnerTaskWhenRunOnLocal() {
        ApiExecutionEngineSupport executionEngine = mock(ApiExecutionEngineSupport.class);
        ApiDefinitionCaseMapper caseMapper = mock(ApiDefinitionCaseMapper.class);
        ApiScenarioRunHistoryMapper scenarioRunHistoryMapper = mock(ApiScenarioRunHistoryMapper.class);
        ApiDataFileDomainService dataFileDomainService = mock(ApiDataFileDomainService.class);
        ApiScenarioTestDatasetDomainService scenarioTestDatasetDomainService = mock(ApiScenarioTestDatasetDomainService.class);
        WorkspaceService workspaceService = mock(WorkspaceService.class);
        ApiWorkspaceScopeSupport workspaceScopeSupport = mock(ApiWorkspaceScopeSupport.class);
        LocalRunnerService localRunnerService = mock(LocalRunnerService.class);

        ApiScenarioEntity scenario = new ApiScenarioEntity();
        scenario.setId(3001L);
        scenario.setWorkspaceId(7L);
        scenario.setScenarioName("Local scenario");
        scenario.setDefaultEnvId(21L);
        scenario.setVariableSetId(31L);
        scenario.setContinueOnFailure(false);
        scenario.setGlobalTimeoutMs(60000);
        scenario.setStepFailureRetryCount(1);
        scenario.setDefaultStepWaitMs(1000);
        scenario.setStepsJson("""
                [{
                  "id": "step-1",
                  "stepName": "Create order",
                  "stepType": "CUSTOM_REQUEST",
                  "enabled": true
                }]
                """);

        WorkspaceEntity workspace = new WorkspaceEntity();
        workspace.setId(7L);
        workspace.setWorkspaceCode("risk-ops");

        when(executionEngine.requireScenario(3001L)).thenReturn(scenario);
        when(executionEngine.buildExecutionContext(7L, 21L, 31L, null, null, null, null)).thenReturn(new ApiExecutionRuntimeModels.ExecutionContext(
                new ApiExecutionRuntimeModels.ResolvedEnvironment(
                        21L,
                        "http://127.0.0.1:18080",
                        List.of(),
                        null,
                        30000,
                        List.of(),
                        31L,
                        null,
                        null,
                        null,
                        null,
                        null,
                        List.of()
                ),
                Map.of("token", "abc"),
                "{}"
        ));
        when(workspaceService.requireWorkspaceById(7L)).thenReturn(workspace);
        when(workspaceService.requireWritableWorkspace("risk-ops")).thenReturn(workspace);
        when(localRunnerService.createDebugTask(any(CreateRunnerTaskCommand.class))).thenReturn(new RunnerTaskDetailResponse(
                "api_scenario_3001_001",
                "API_SCENARIO_RUN",
                null,
                "PENDING",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                Map.of()
        ));

        ApiExecutionDomainService service = new ApiExecutionDomainService(
                executionEngine,
                caseMapper,
                scenarioRunHistoryMapper,
                dataFileDomainService,
                scenarioTestDatasetDomainService,
                workspaceService,
                workspaceScopeSupport,
                localRunnerService
        );

        var response = service.runScenario(3001L, "risk-ops", new ApiRunRequest(
                "risk-ops",
                21L,
                31L,
                null,
                null,
                "LOCAL",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "runner-api-1"
        ));

        ArgumentCaptor<CreateRunnerTaskCommand> commandCaptor = ArgumentCaptor.forClass(CreateRunnerTaskCommand.class);
        verify(localRunnerService).createDebugTask(commandCaptor.capture());
        CreateRunnerTaskCommand command = commandCaptor.getValue();

        assertThat(response.result()).isEqualTo("PENDING");
        assertThat(response.failureSummary()).isEqualTo("Local Runner task created");
        assertThat(command.workspaceId()).isEqualTo(7L);
        assertThat(command.workspaceCode()).isEqualTo("risk-ops");
        assertThat(command.taskType()).isEqualTo("API_SCENARIO_RUN");
        assertThat(command.executionLocation()).isEqualTo("LOCAL_RUNNER");
        assertThat(command.runnerId()).isEqualTo("runner-api-1");
        assertThat(command.timeoutPolicy()).containsEntry("requestTimeoutMs", 30000);
        assertThat(command.timeoutPolicy()).containsEntry("scriptTimeoutMs", 1000);
        assertThat(command.environmentSnapshot()).containsEntry("environmentId", 21L);
        assertThat(command.environmentSnapshot()).containsEntry("baseUrl", "http://127.0.0.1:18080");
        assertThat(command.variableSnapshot()).containsEntry("variableSetId", 31L);
        assertThat(command.variableSnapshot()).containsEntry("variables", Map.of("token", "abc"));
        assertThat(command.payload()).containsKey("scenarioSnapshot");

        @SuppressWarnings("unchecked")
        Map<String, Object> runOptions = (Map<String, Object>) command.payload().get("runOptions");
        assertThat(runOptions).containsEntry("stopOnFirstFailure", true);
        assertThat(runOptions).containsEntry("formalReport", true);
        assertThat(runOptions).containsEntry("debugMode", false);
        @SuppressWarnings("unchecked")
        Map<String, Object> scenarioSnapshot = (Map<String, Object>) command.payload().get("scenarioSnapshot");
        assertThat(scenarioSnapshot).containsEntry("scenarioId", 3001L);
        assertThat(scenarioSnapshot).containsEntry("scenarioName", "Local scenario");
        assertThat((List<?>) scenarioSnapshot.get("steps")).hasSize(1);
    }

    @Test
    void runScenarioExpandsReferencedCaseSnapshotForLocalRunner() {
        ApiExecutionEngineSupport executionEngine = mock(ApiExecutionEngineSupport.class);
        ApiDefinitionCaseMapper caseMapper = mock(ApiDefinitionCaseMapper.class);
        ApiScenarioRunHistoryMapper scenarioRunHistoryMapper = mock(ApiScenarioRunHistoryMapper.class);
        ApiDataFileDomainService dataFileDomainService = mock(ApiDataFileDomainService.class);
        ApiScenarioTestDatasetDomainService scenarioTestDatasetDomainService = mock(ApiScenarioTestDatasetDomainService.class);
        WorkspaceService workspaceService = mock(WorkspaceService.class);
        ApiWorkspaceScopeSupport workspaceScopeSupport = mock(ApiWorkspaceScopeSupport.class);
        LocalRunnerService localRunnerService = mock(LocalRunnerService.class);

        ApiScenarioEntity scenario = new ApiScenarioEntity();
        scenario.setId(3002L);
        scenario.setWorkspaceId(7L);
        scenario.setScenarioName("Local scripted scenario");
        scenario.setDefaultEnvId(21L);
        scenario.setVariableSetId(31L);
        scenario.setContinueOnFailure(true);
        scenario.setStepsJson("""
                [{
                  "id": "step-case-1",
                  "stepName": "Create order by case",
                  "stepType": "API_CASE",
                  "refType": "REF",
                  "resourceType": "CASE",
                  "resourceId": 9001,
                  "enabled": true
                }]
                """);

        ApiDefinitionCaseEntity apiCase = new ApiDefinitionCaseEntity();
        apiCase.setId(9001L);
        apiCase.setWorkspaceId(7L);
        apiCase.setDefinitionId(8001L);
        apiCase.setCaseName("Create order case");
        apiCase.setRequestJson("""
                {
                  "method": "POST",
                  "path": "/orders",
                  "headers": [{"key": "X-Token", "value": "{{token}}", "enabled": true}],
                  "body": {"bodyType": "RAW", "rawBody": "{\\"name\\":\\"{{orderName}}\\"}"}
                }
                """);
        apiCase.setAssertionsJson("""
                [{"id": "status-ok", "type": "STATUS_CODE", "expectedValue": "200", "enabled": true}]
                """);
        apiCase.setPreprocessorsJson("""
                [{"id": "pre-token", "processorType": "SCRIPT", "scriptLanguage": "JAVASCRIPT", "enabled": true, "script": "variables.set('token', 'local-token');"}]
                """);
        apiCase.setPostprocessorsJson("""
                [{"id": "post-order", "processorType": "SCRIPT", "scriptLanguage": "JAVASCRIPT", "enabled": true, "script": "variables.set('orderId', response.json().id);"}]
                """);

        WorkspaceEntity workspace = new WorkspaceEntity();
        workspace.setId(7L);
        workspace.setWorkspaceCode("risk-ops");

        when(executionEngine.requireScenario(3002L)).thenReturn(scenario);
        when(executionEngine.buildExecutionContext(7L, 21L, 31L, null, null, null, null)).thenReturn(new ApiExecutionRuntimeModels.ExecutionContext(
                new ApiExecutionRuntimeModels.ResolvedEnvironment(
                        21L,
                        "http://127.0.0.1:18080",
                        List.of(),
                        null,
                        30000,
                        List.of(),
                        31L,
                        null,
                        null,
                        null,
                        null,
                        null,
                        List.of()
                ),
                Map.of("orderName", "codex"),
                "{}"
        ));
        when(caseMapper.selectById(9001L)).thenReturn(apiCase);
        when(workspaceService.requireWorkspaceById(7L)).thenReturn(workspace);
        when(workspaceService.requireWritableWorkspace("risk-ops")).thenReturn(workspace);
        when(localRunnerService.createDebugTask(any(CreateRunnerTaskCommand.class))).thenReturn(new RunnerTaskDetailResponse(
                "api_scenario_3002_001",
                "API_SCENARIO_RUN",
                null,
                "PENDING",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                Map.of()
        ));

        ApiExecutionDomainService service = new ApiExecutionDomainService(
                executionEngine,
                caseMapper,
                scenarioRunHistoryMapper,
                dataFileDomainService,
                scenarioTestDatasetDomainService,
                workspaceService,
                workspaceScopeSupport,
                localRunnerService
        );

        service.runScenario(3002L, "risk-ops", new ApiRunRequest(
                "risk-ops",
                21L,
                31L,
                null,
                null,
                "LOCAL",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "runner-api-1"
        ));

        ArgumentCaptor<CreateRunnerTaskCommand> commandCaptor = ArgumentCaptor.forClass(CreateRunnerTaskCommand.class);
        verify(localRunnerService).createDebugTask(commandCaptor.capture());

        @SuppressWarnings("unchecked")
        Map<String, Object> scenarioSnapshot = (Map<String, Object>) commandCaptor.getValue().payload().get("scenarioSnapshot");
        @SuppressWarnings("unchecked")
        Map<String, Object> step = (Map<String, Object>) ((List<?>) scenarioSnapshot.get("steps")).get(0);
        @SuppressWarnings("unchecked")
        Map<String, Object> caseSnapshot = (Map<String, Object>) step.get("caseSnapshot");
        @SuppressWarnings("unchecked")
        Map<String, Object> request = (Map<String, Object>) caseSnapshot.get("request");

        assertThat(step).containsEntry("stepId", "step-case-1");
        assertThat(caseSnapshot).containsEntry("caseId", 9001L);
        assertThat(caseSnapshot).containsEntry("caseName", "Create order case");
        assertThat(caseSnapshot).containsEntry("preScript", "variables.set('token', 'local-token');");
        assertThat(caseSnapshot).containsEntry("postScript", "variables.set('orderId', response.json().id);");
        assertThat(request).containsEntry("method", "POST");
        assertThat(request).containsEntry("url", "{{baseUrl}}/orders");
        assertThat((List<?>) caseSnapshot.get("assertions")).hasSize(1);
    }
}
