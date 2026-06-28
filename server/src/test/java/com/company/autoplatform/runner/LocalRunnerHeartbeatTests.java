package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static com.company.autoplatform.runner.LocalRunnerModels.RunnerHealthPayload;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocalRunnerHeartbeatTests {

    @Test
    void heartbeatStoresRuntimeTaskAndResourceSnapshots() {
        LocalRunnerNodeMapper nodeMapper = mock(LocalRunnerNodeMapper.class);
        LocalRunnerTaskMapper taskMapper = mock(LocalRunnerTaskMapper.class);
        LocalRunnerNodeEntity runner = new LocalRunnerNodeEntity();
        runner.setRunnerId("runner-heartbeat");
        runner.setRunnerToken("token-heartbeat");
        runner.setStatus("ONLINE");
        runner.setLastHeartbeatAt(LocalDateTime.now().minusSeconds(10));
        when(nodeMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(runner);

        LocalRunnerService service = new LocalRunnerService(
                nodeMapper,
                taskMapper,
                mock(LocalRunnerTaskLogMapper.class),
                new ObjectMapper(),
                mock(ApplicationEventPublisher.class)
        );

        service.heartbeat(new RunnerHealthPayload(
                "runner-heartbeat",
                "token-heartbeat",
                "0.1.0",
                "1.0",
                List.of("WEB_CASE_RUN"),
                "task-1001",
                "run-1001",
                2,
                Map.of("maxSlots", 5, "usedSlots", 5, "availableSlots", 0),
                Map.of("chromium", "ready"),
                Map.of("pageAlive", true)
        ));

        assertThat(runner.getResourceJson()).contains("\"maxSlots\":5", "\"availableSlots\":0");
        assertThat(runner.getBrowserJson()).contains("\"chromium\":\"ready\"");
        assertThat(runner.getSessionJson()).contains(
                "\"pageAlive\":true",
                "\"currentTaskId\":\"task-1001\"",
                "\"currentRunId\":\"run-1001\"",
                "\"queueSize\":2"
        );
        assertThat(runner.getStatus()).isEqualTo("ONLINE");
        assertThat(runner.getLastHeartbeatAt()).isNotNull();
        verify(nodeMapper).updateById(runner);
    }
}
