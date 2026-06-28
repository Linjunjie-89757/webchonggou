package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LocalRunnerNodeQueryTests {

    @Test
    void listRunnerNodesReturnsHeartbeatAgeOfflineFlagAndRuntimeSnapshots() {
        LocalRunnerNodeMapper nodeMapper = mock(LocalRunnerNodeMapper.class);
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        LocalRunnerService service = new LocalRunnerService(
                nodeMapper,
                taskMapper,
                mock(LocalRunnerTaskLogMapper.class),
                new ObjectMapper(),
                mock(ApplicationEventPublisher.class)
        );
        LocalDateTime now = LocalDateTime.now();
        LocalRunnerNodeEntity staleRunner = runner("runner-stale", "OFFICE-PC", now.minusMinutes(3));
        staleRunner.setCapabilitiesJson("[\"WEB_CASE_RUN\",\"API_CASE_RUN\"]");
        staleRunner.setResourceJson("{\"maxSlots\":5,\"usedSlots\":1,\"availableSlots\":4}");
        staleRunner.setBrowserJson("{\"chromium\":\"ready\"}");
        staleRunner.setSessionJson("{\"activePageUrl\":\"https://example.test\"}");
        LocalRunnerNodeEntity activeRunner = runner("runner-active", "DEV-LAPTOP", now.minusSeconds(20));
        LocalRunnerTaskEntity runningTask = task("run-web", "runner-stale", "WEB_CASE_RUN", "RUNNING", now.minusMinutes(4), 5);
        LocalRunnerTaskEntity assignedTask = task("run-api", "runner-stale", "API_SCENARIO_RUN", "ASSIGNED", now.minusMinutes(1), 1);
        LocalRunnerTaskEntity finishedTask = task("run-done", "runner-stale", "API_CASE_RUN", "SUCCESS", now.minusMinutes(10), 1);

        when(nodeMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(staleRunner, activeRunner));
        when(taskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(runningTask, assignedTask, finishedTask));

        List<LocalRunnerModels.RunnerNodeSummaryResponse> nodes = service.listRunnerNodes(Duration.ofMinutes(2));

        assertThat(nodes).hasSize(2);
        assertThat(nodes.get(0).runnerId()).isEqualTo("runner-stale");
        assertThat(nodes.get(0).runnerName()).isEqualTo("OFFICE-PC");
        assertThat(nodes.get(0).offline()).isTrue();
        assertThat(nodes.get(0).secondsSinceHeartbeat()).isGreaterThanOrEqualTo(170);
        assertThat(nodes.get(0).capabilities()).containsExactly("WEB_CASE_RUN", "API_CASE_RUN");
        assertThat(nodes.get(0).resource()).containsEntry("availableSlots", 4);
        assertThat(nodes.get(0).browser()).containsEntry("chromium", "ready");
        assertThat(nodes.get(0).session()).containsEntry("activePageUrl", "https://example.test");
        assertThat(nodes.get(0).activeTasks()).hasSize(2);
        assertThat(nodes.get(0).activeTasks().get(0).runId()).isEqualTo("run-web");
        assertThat(nodes.get(0).activeTasks().get(0).runningSeconds()).isGreaterThanOrEqualTo(230);
        assertThat(nodes.get(0).activeTasks().get(1).runId()).isEqualTo("run-api");
        assertThat(nodes.get(1).runnerId()).isEqualTo("runner-active");
        assertThat(nodes.get(1).offline()).isFalse();
        assertThat(nodes.get(1).activeTasks()).isEmpty();
    }

    private LocalRunnerNodeEntity runner(String runnerId, String runnerName, LocalDateTime lastHeartbeatAt) {
        LocalRunnerNodeEntity entity = new LocalRunnerNodeEntity();
        entity.setRunnerId(runnerId);
        entity.setRunnerName(runnerName);
        entity.setRunnerVersion("0.1.0");
        entity.setProtocolVersion("1.0");
        entity.setStatus("ONLINE");
        entity.setLastHeartbeatAt(lastHeartbeatAt);
        return entity;
    }

    private LocalRunnerTaskEntity task(
            String runId,
            String runnerId,
            String taskType,
            String status,
            LocalDateTime startedAt,
            Integer resourceCost
    ) {
        LocalRunnerTaskEntity entity = new LocalRunnerTaskEntity();
        entity.setRunId(runId);
        entity.setRunnerId(runnerId);
        entity.setTaskType(taskType);
        entity.setStatus(status);
        entity.setCurrentStage("VALIDATING");
        entity.setProgressPercent(45);
        entity.setResourceCost(resourceCost);
        entity.setStartedAt(startedAt);
        entity.setAssignedAt(startedAt.minusSeconds(20));
        return entity;
    }
}
