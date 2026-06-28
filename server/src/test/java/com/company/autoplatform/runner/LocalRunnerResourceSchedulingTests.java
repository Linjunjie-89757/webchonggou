package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static com.company.autoplatform.runner.LocalRunnerModels.PullRunnerTaskRequest;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocalRunnerResourceSchedulingTests {

    @Test
    void pullTaskKeepsTaskPendingWhenResourceSlotsAreInsufficient() {
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        LocalRunnerService service = service(taskMapper, runner("runner-a"));
        LocalRunnerTaskEntity heavyTask = task("run-web", "WEB_CASE_RUN", "MANUAL", 5, null, 1);

        when(taskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(heavyTask));

        var response = service.pullTask(new PullRunnerTaskRequest(
                "runner-a",
                "token-a",
                "0.1.0",
                "1.0",
                List.of("WEB_CASE_RUN"),
                List.of("risk-ops"),
                Map.of("maxSlots", 4, "usedSlots", 0),
                List.of()
        ));

        assertThat(response.hasTask()).isFalse();
        assertThat(heavyTask.getStatus()).isEqualTo("PENDING");
        verify(taskMapper, never()).updateById(heavyTask);
    }

    @Test
    void pullTaskPrefersHigherPriorityTaskThatFitsAvailableSlots() {
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        LocalRunnerService service = service(taskMapper, runner("runner-a"));
        LocalRunnerTaskEntity ciTask = task("run-ci", "API_SCENARIO_RUN", "CI", 1, null, 1);
        LocalRunnerTaskEntity debugTask = task("run-debug", "API_SCENARIO_RUN", "DEBUG", 1, null, 2);

        when(taskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(ciTask, debugTask));

        var response = service.pullTask(new PullRunnerTaskRequest(
                "runner-a",
                "token-a",
                "0.1.0",
                "1.0",
                List.of("API_SCENARIO_RUN"),
                List.of("risk-ops"),
                Map.of("maxSlots", 2, "usedSlots", 0),
                List.of()
        ));

        assertThat(response.hasTask()).isTrue();
        assertThat(response.task().runId()).isEqualTo("run-debug");
        assertThat(debugTask.getStatus()).isEqualTo("ASSIGNED");
        assertThat(debugTask.getRunnerId()).isEqualTo("runner-a");
        assertThat(ciTask.getStatus()).isEqualTo("PENDING");
        verify(taskMapper).updateById(debugTask);
        verify(taskMapper, never()).updateById(ciTask);
    }

    @Test
    void pullTaskDoesNotAssignTaskBoundToAnotherRunner() {
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        LocalRunnerService service = service(taskMapper, runner("runner-a"));
        LocalRunnerTaskEntity otherRunnerTask = task("run-bound", "API_SCENARIO_RUN", "DEBUG", 1, "runner-b", 1);

        when(taskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(otherRunnerTask));

        var response = service.pullTask(new PullRunnerTaskRequest(
                "runner-a",
                "token-a",
                "0.1.0",
                "1.0",
                List.of("API_SCENARIO_RUN"),
                List.of("risk-ops"),
                Map.of("maxSlots", 2, "usedSlots", 0),
                List.of()
        ));

        assertThat(response.hasTask()).isFalse();
        assertThat(otherRunnerTask.getStatus()).isEqualTo("PENDING");
        verify(taskMapper, never()).updateById(otherRunnerTask);
    }

    private LocalRunnerService service(LocalRunnerTaskMapper taskMapper, LocalRunnerNodeEntity runner) {
        LocalRunnerNodeMapper nodeMapper = mock(LocalRunnerNodeMapper.class);
        LocalRunnerTaskLogMapper taskLogMapper = mock(LocalRunnerTaskLogMapper.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        when(nodeMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(runner);
        return new LocalRunnerService(nodeMapper, taskMapper, taskLogMapper, new ObjectMapper(), eventPublisher);
    }

    private LocalRunnerNodeEntity runner(String runnerId) {
        LocalRunnerNodeEntity entity = new LocalRunnerNodeEntity();
        entity.setRunnerId(runnerId);
        entity.setRunnerToken("token-a");
        entity.setCapabilitiesJson("[]");
        return entity;
    }

    private LocalRunnerTaskEntity task(
            String runId,
            String taskType,
            String priority,
            Integer resourceCost,
            String runnerId,
            int createdAtOffsetSeconds
    ) {
        LocalRunnerTaskEntity entity = new LocalRunnerTaskEntity();
        entity.setRunId(runId);
        entity.setTaskType(taskType);
        entity.setExecutionLocation("LOCAL_RUNNER");
        entity.setExecutionToken("exec-" + runId);
        entity.setWorkspaceCode("risk-ops");
        entity.setRunnerId(runnerId);
        entity.setPriority(priority);
        entity.setResourceCost(resourceCost);
        entity.setStatus("PENDING");
        entity.setCreatedAt(LocalDateTime.now().plusSeconds(createdAtOffsetSeconds));
        entity.setTimeoutPolicyJson("{}");
        entity.setEnvironmentSnapshotJson("{}");
        entity.setVariableSnapshotJson("{}");
        entity.setScriptSnapshotJson("{}");
        entity.setArtifactRefsJson("[]");
        entity.setMaskingRulesJson("[]");
        entity.setScreenshotPolicyJson("{}");
        entity.setPayloadJson("{}");
        return entity;
    }
}
