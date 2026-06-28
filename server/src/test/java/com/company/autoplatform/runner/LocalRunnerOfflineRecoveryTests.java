package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocalRunnerOfflineRecoveryTests {

    @Test
    void markOfflineRunnersMarksStaleRunnerAndRunningTasksAsRunnerOffline() {
        LocalRunnerNodeMapper nodeMapper = mock(LocalRunnerNodeMapper.class);
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        LocalRunnerTaskLogMapper taskLogMapper = mock(LocalRunnerTaskLogMapper.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        LocalRunnerService service = new LocalRunnerService(nodeMapper, taskMapper, taskLogMapper, new ObjectMapper(), eventPublisher);
        LocalRunnerNodeEntity staleRunner = runner("runner-offline", LocalDateTime.now().minusMinutes(5));
        LocalRunnerTaskEntity assignedTask = task("run-assigned", "ASSIGNED");
        LocalRunnerTaskEntity runningTask = task("run-running", "RUNNING");

        when(nodeMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(staleRunner));
        when(taskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(assignedTask, runningTask));

        int changed = service.markOfflineRunners(Duration.ofMinutes(2));

        assertThat(changed).isEqualTo(2);
        assertThat(staleRunner.getStatus()).isEqualTo("OFFLINE");
        assertThat(assignedTask.getStatus()).isEqualTo("RUNNER_OFFLINE");
        assertThat(assignedTask.getErrorMessage()).contains("Runner offline");
        assertThat(assignedTask.getCompletedAt()).isNotNull();
        assertThat(runningTask.getStatus()).isEqualTo("RUNNER_OFFLINE");
        assertThat(runningTask.getErrorMessage()).contains("Runner offline");
        verify(nodeMapper).updateById(staleRunner);
        verify(taskMapper, times(2)).updateById(any(LocalRunnerTaskEntity.class));
    }

    @Test
    void markOfflineRunnersDoesNotMarkRecentHeartbeatRunner() {
        LocalRunnerNodeMapper nodeMapper = mock(LocalRunnerNodeMapper.class);
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        LocalRunnerService service = new LocalRunnerService(
                nodeMapper,
                taskMapper,
                mock(LocalRunnerTaskLogMapper.class),
                new ObjectMapper(),
                mock(ApplicationEventPublisher.class)
        );

        when(nodeMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        int changed = service.markOfflineRunners(Duration.ofMinutes(2));

        assertThat(changed).isZero();
        verify(taskMapper, times(0)).selectList(any(LambdaQueryWrapper.class));
    }

    private LocalRunnerNodeEntity runner(String runnerId, LocalDateTime lastHeartbeatAt) {
        LocalRunnerNodeEntity entity = new LocalRunnerNodeEntity();
        entity.setRunnerId(runnerId);
        entity.setStatus("ONLINE");
        entity.setLastHeartbeatAt(lastHeartbeatAt);
        return entity;
    }

    private LocalRunnerTaskEntity task(String runId, String status) {
        LocalRunnerTaskEntity entity = new LocalRunnerTaskEntity();
        entity.setRunId(runId);
        entity.setRunnerId("runner-offline");
        entity.setStatus(status);
        return entity;
    }
}
