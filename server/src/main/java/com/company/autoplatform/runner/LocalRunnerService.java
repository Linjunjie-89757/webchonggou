package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.company.autoplatform.runner.LocalRunnerModels.*;

@Service
public class LocalRunnerService {

    private static final int DEFAULT_POLL_INTERVAL_MS = 2000;
    private static final String ONLINE = "ONLINE";
    private static final String PENDING = "PENDING";
    private static final String ASSIGNED = "ASSIGNED";
    private static final String RUNNING = "RUNNING";
    private static final List<String> TERMINAL_STATUSES = List.of(
            "SUCCESS",
            "FAILED",
            "CANCELED",
            "DEGRADED",
            "TIMEOUT",
            "RUNNER_OFFLINE"
    );

    private final LocalRunnerNodeMapper nodeMapper;
    private final LocalRunnerTaskMapper taskMapper;
    private final LocalRunnerTaskLogMapper taskLogMapper;
    private final ObjectMapper objectMapper;

    public LocalRunnerService(
            LocalRunnerNodeMapper nodeMapper,
            LocalRunnerTaskMapper taskMapper,
            LocalRunnerTaskLogMapper taskLogMapper,
            ObjectMapper objectMapper
    ) {
        this.nodeMapper = nodeMapper;
        this.taskMapper = taskMapper;
        this.taskLogMapper = taskLogMapper;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public RunnerRegisterResponse register(RunnerRegisterRequest request) {
        LocalDateTime now = LocalDateTime.now();
        String installId = requireText(request.installId(), "installId cannot be blank");
        LocalRunnerNodeEntity entity = nodeMapper.selectOne(new LambdaQueryWrapper<LocalRunnerNodeEntity>()
                .eq(LocalRunnerNodeEntity::getInstallId, installId)
                .last("LIMIT 1"));
        if (entity == null) {
            entity = new LocalRunnerNodeEntity();
            entity.setRunnerId("runner_" + UUID.randomUUID().toString().replace("-", ""));
            entity.setRunnerToken(UUID.randomUUID().toString().replace("-", ""));
            entity.setInstallId(installId);
            entity.setCreatedAt(now);
        }
        entity.setRunnerName(resolveRunnerName(request.machineHint(), entity.getRunnerId()));
        entity.setRunnerVersion(blankToDefault(request.runnerVersion(), "unknown"));
        entity.setProtocolVersion(blankToDefault(request.protocolVersion(), "1.0"));
        entity.setCapabilitiesJson(writeJson(request.capabilities() == null ? List.of() : request.capabilities()));
        entity.setMachineHintJson(writeJson(request.machineHint() == null ? Map.of() : request.machineHint()));
        entity.setStatus(ONLINE);
        entity.setLastHeartbeatAt(now);
        entity.setUpdatedAt(now);
        if (entity.getId() == null) {
            nodeMapper.insert(entity);
        } else {
            nodeMapper.updateById(entity);
        }
        return new RunnerRegisterResponse(
                entity.getRunnerId(),
                entity.getRunnerToken(),
                entity.getRunnerName(),
                entity.getProtocolVersion(),
                true,
                "Runner registered"
        );
    }

    @Transactional
    public RunnerTaskAckResponse heartbeat(RunnerHealthPayload payload) {
        LocalRunnerNodeEntity entity = requireRunner(payload.runnerId());
        validateRunnerToken(entity, payload.runnerToken());
        LocalDateTime now = LocalDateTime.now();
        entity.setRunnerVersion(blankToDefault(payload.runnerVersion(), entity.getRunnerVersion()));
        entity.setProtocolVersion(blankToDefault(payload.protocolVersion(), entity.getProtocolVersion()));
        entity.setCapabilitiesJson(writeJson(payload.capabilities() == null ? List.of() : payload.capabilities()));
        entity.setResourceJson(writeJson(payload.resource() == null ? Map.of() : payload.resource()));
        entity.setBrowserJson(writeJson(payload.browser() == null ? Map.of() : payload.browser()));
        entity.setSessionJson(writeJson(payload.session() == null ? Map.of() : payload.session()));
        entity.setStatus(ONLINE);
        entity.setLastHeartbeatAt(now);
        entity.setUpdatedAt(now);
        nodeMapper.updateById(entity);
        return new RunnerTaskAckResponse(payload.currentRunId(), ONLINE, true, "Heartbeat accepted");
    }

    @Transactional
    public PullRunnerTaskResponse pullTask(PullRunnerTaskRequest request) {
        LocalRunnerNodeEntity runner = requireRunner(request.runnerId());
        validateRunnerToken(runner, request.runnerToken());
        heartbeat(new RunnerHealthPayload(
                request.runnerId(),
                request.runnerToken(),
                request.runnerVersion(),
                request.protocolVersion(),
                request.capabilities(),
                null,
                null,
                null,
                request.resource(),
                null,
                null
        ));

        LocalRunnerTaskEntity task = taskMapper.selectOne(new LambdaQueryWrapper<LocalRunnerTaskEntity>()
                .eq(LocalRunnerTaskEntity::getStatus, PENDING)
                .and(wrapper -> wrapper
                        .isNull(LocalRunnerTaskEntity::getRunnerId)
                        .or()
                        .eq(LocalRunnerTaskEntity::getRunnerId, request.runnerId()))
                .orderByAsc(LocalRunnerTaskEntity::getCreatedAt)
                .last("LIMIT 1"));
        if (task == null) {
            return new PullRunnerTaskResponse(false, LocalDateTime.now(), DEFAULT_POLL_INTERVAL_MS, null);
        }
        LocalDateTime now = LocalDateTime.now();
        task.setRunnerId(request.runnerId());
        task.setStatus(ASSIGNED);
        task.setAssignedAt(now);
        task.setLastReportedAt(now);
        task.setUpdatedAt(now);
        taskMapper.updateById(task);
        return new PullRunnerTaskResponse(true, now, DEFAULT_POLL_INTERVAL_MS, toEnvelope(task));
    }

    @Transactional
    public RunnerTaskAckResponse reportStatus(String runId, RunnerTaskStatusReport report) {
        LocalRunnerTaskEntity task = requireTask(runId);
        validateExecutionToken(task, report.runnerId(), report.executionToken());
        LocalDateTime now = report.reportedAt() == null ? LocalDateTime.now() : report.reportedAt();
        String status = normalizeStatus(report.status(), RUNNING);
        task.setStatus(status);
        task.setCurrentStage(blankToNull(report.currentStage()));
        if (report.progress() != null) {
            task.setProgressCurrent(defaultNumber(report.progress().current()));
            task.setProgressTotal(defaultNumber(report.progress().total()));
            task.setProgressPercent(defaultNumber(report.progress().percent()));
        }
        task.setStatusMessage(blankToNull(report.message()));
        if (RUNNING.equals(status) && task.getStartedAt() == null) {
            task.setStartedAt(now);
        }
        if (isTerminalStatus(status)) {
            task.setCompletedAt(now);
        }
        task.setLastReportedAt(now);
        task.setUpdatedAt(LocalDateTime.now());
        taskMapper.updateById(task);
        return new RunnerTaskAckResponse(runId, task.getStatus(), true, "Status accepted");
    }

    @Transactional
    public RunnerTaskAckResponse appendLog(String runId, RunnerTaskLogReport report) {
        LocalRunnerTaskEntity task = requireTask(runId);
        validateExecutionToken(task, report.runnerId(), report.executionToken());
        Long sequenceNo = report.sequenceNo() == null ? System.currentTimeMillis() : report.sequenceNo();
        Long existing = taskLogMapper.selectCount(new LambdaQueryWrapper<LocalRunnerTaskLogEntity>()
                .eq(LocalRunnerTaskLogEntity::getRunId, runId)
                .eq(LocalRunnerTaskLogEntity::getSequenceNo, sequenceNo));
        if (existing == null || existing == 0) {
            LocalRunnerTaskLogEntity log = new LocalRunnerTaskLogEntity();
            log.setRunId(runId);
            log.setRunnerId(report.runnerId());
            log.setSequenceNo(sequenceNo);
            log.setLevel(blankToDefault(report.level(), "INFO"));
            log.setMessage(blankToNull(report.message()));
            log.setStepId(blankToNull(report.stepId()));
            log.setDataJson(writeJson(report.data() == null ? Map.of() : report.data()));
            log.setLoggedAt(report.timestamp() == null ? LocalDateTime.now() : report.timestamp());
            log.setCreatedAt(LocalDateTime.now());
            log.setUpdatedAt(LocalDateTime.now());
            taskLogMapper.insert(log);
        }
        touchTaskReportTime(task);
        return new RunnerTaskAckResponse(runId, task.getStatus(), true, "Log accepted");
    }

    @Transactional
    public RunnerTaskAckResponse reportStepResult(String runId, RunnerStepResultReport report) {
        LocalRunnerTaskEntity task = requireTask(runId);
        validateExecutionToken(task, report.runnerId(), report.executionToken());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("stepId", report.stepId());
        data.put("status", blankToDefault(report.status(), "UNKNOWN"));
        data.put("startedAt", report.startedAt());
        data.put("finishedAt", report.finishedAt());
        data.put("durationMs", report.durationMs());
        data.put("errorMessage", report.errorMessage());
        data.put("screenshotRef", report.screenshotRef());
        data.put("extra", report.extra() == null ? Map.of() : report.extra());
        appendLog(runId, new RunnerTaskLogReport(
                report.runnerId(),
                report.executionToken(),
                System.currentTimeMillis(),
                "INFO",
                "Step result: " + report.stepId(),
                report.stepId(),
                data,
                LocalDateTime.now()
        ));
        return new RunnerTaskAckResponse(runId, task.getStatus(), true, "Step result accepted");
    }

    @Transactional
    public RunnerTaskAckResponse reportFinalResult(String runId, RunnerFinalResultReport report) {
        LocalRunnerTaskEntity task = requireTask(runId);
        validateExecutionToken(task, report.runnerId(), report.executionToken());
        LocalDateTime now = LocalDateTime.now();
        String status = normalizeStatus(report.status(), "SUCCESS");
        task.setStatus(status);
        task.setStartedAt(report.startedAt() == null ? task.getStartedAt() : report.startedAt());
        task.setCompletedAt(report.finishedAt() == null ? now : report.finishedAt());
        task.setErrorMessage(blankToNull(report.errorMessage()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", report.summary() == null ? Map.of() : report.summary());
        result.put("durationMs", report.durationMs());
        result.put("reportData", report.reportData() == null ? Map.of() : report.reportData());
        task.setResultJson(writeJson(result));
        task.setLastReportedAt(now);
        task.setUpdatedAt(now);
        taskMapper.updateById(task);
        return new RunnerTaskAckResponse(runId, task.getStatus(), true, "Final result accepted");
    }

    @Transactional
    public LocalRunnerTaskEntity createTask(CreateRunnerTaskCommand command) {
        LocalDateTime now = LocalDateTime.now();
        String requestedRunId = blankToNull(command.runId());
        if (requestedRunId != null) {
            LocalRunnerTaskEntity existing = taskMapper.selectOne(new LambdaQueryWrapper<LocalRunnerTaskEntity>()
                    .eq(LocalRunnerTaskEntity::getRunId, requestedRunId)
                    .last("LIMIT 1"));
            if (existing != null) {
                return existing;
            }
        }
        LocalRunnerTaskEntity entity = new LocalRunnerTaskEntity();
        entity.setWorkspaceId(command.workspaceId());
        entity.setWorkspaceCode(blankToNull(command.workspaceCode()));
        entity.setRunId(blankToDefault(requestedRunId, "run_" + UUID.randomUUID().toString().replace("-", "")));
        entity.setTaskType(requireText(command.taskType(), "taskType cannot be blank"));
        entity.setExecutionLocation(blankToDefault(command.executionLocation(), "LOCAL_RUNNER"));
        entity.setExecutionToken(UUID.randomUUID().toString().replace("-", ""));
        entity.setRunnerId(blankToNull(command.runnerId()));
        entity.setUserId(blankToNull(command.userId()));
        entity.setProtocolVersion(blankToDefault(command.protocolVersion(), "1.0"));
        entity.setPriority(blankToDefault(command.priority(), "MANUAL"));
        entity.setResourceCost(command.resourceCost() == null || command.resourceCost() <= 0 ? 1 : command.resourceCost());
        entity.setStatus(PENDING);
        entity.setProgressCurrent(0);
        entity.setProgressTotal(0);
        entity.setProgressPercent(0);
        entity.setDeadlineAt(command.deadlineAt());
        entity.setTimeoutPolicyJson(writeJson(command.timeoutPolicy() == null ? Map.of() : command.timeoutPolicy()));
        entity.setEnvironmentSnapshotJson(writeJson(command.environmentSnapshot() == null ? Map.of() : command.environmentSnapshot()));
        entity.setVariableSnapshotJson(writeJson(command.variableSnapshot() == null ? Map.of() : command.variableSnapshot()));
        entity.setScriptSnapshotJson(writeJson(command.scriptSnapshot() == null ? Map.of() : command.scriptSnapshot()));
        entity.setArtifactRefsJson(writeJson(command.artifactRefs() == null ? List.of() : command.artifactRefs()));
        entity.setMaskingRulesJson(writeJson(command.maskingRules() == null ? List.of() : command.maskingRules()));
        entity.setScreenshotPolicyJson(writeJson(command.screenshotPolicy() == null ? Map.of() : command.screenshotPolicy()));
        entity.setPayloadJson(writeJson(command.payload() == null ? Map.of() : command.payload()));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        taskMapper.insert(entity);
        return entity;
    }

    @Transactional
    public RunnerTaskDetailResponse createDebugTask(CreateRunnerTaskCommand command) {
        return toTaskDetail(createTask(command));
    }

    public RunnerTaskDetailResponse getTaskDetail(String runId) {
        return toTaskDetail(requireTask(runId));
    }

    public RunnerTaskEnvelope toEnvelope(LocalRunnerTaskEntity task) {
        return new RunnerTaskEnvelope(
                task.getRunId(),
                task.getTaskType(),
                task.getExecutionLocation(),
                task.getExecutionToken(),
                task.getRunnerId(),
                task.getWorkspaceCode(),
                task.getUserId(),
                task.getProtocolVersion(),
                task.getPriority(),
                task.getResourceCost(),
                task.getCreatedAt(),
                task.getDeadlineAt(),
                readMap(task.getTimeoutPolicyJson()),
                readMap(task.getEnvironmentSnapshotJson()),
                readMap(task.getVariableSnapshotJson()),
                readMap(task.getScriptSnapshotJson()),
                readListMap(task.getArtifactRefsJson()),
                readListMap(task.getMaskingRulesJson()),
                readMap(task.getScreenshotPolicyJson()),
                readMap(task.getPayloadJson())
        );
    }

    private RunnerTaskDetailResponse toTaskDetail(LocalRunnerTaskEntity task) {
        return new RunnerTaskDetailResponse(
                task.getRunId(),
                task.getTaskType(),
                task.getRunnerId(),
                task.getStatus(),
                task.getCurrentStage(),
                new Progress(
                        task.getProgressCurrent(),
                        task.getProgressTotal(),
                        task.getProgressPercent()
                ),
                task.getStatusMessage(),
                task.getErrorMessage(),
                task.getAssignedAt(),
                task.getStartedAt(),
                task.getCompletedAt(),
                task.getLastReportedAt(),
                toEnvelope(task),
                readMap(task.getResultJson())
        );
    }

    private LocalRunnerNodeEntity requireRunner(String runnerId) {
        String normalized = requireText(runnerId, "runnerId cannot be blank");
        LocalRunnerNodeEntity entity = nodeMapper.selectOne(new LambdaQueryWrapper<LocalRunnerNodeEntity>()
                .eq(LocalRunnerNodeEntity::getRunnerId, normalized)
                .last("LIMIT 1"));
        if (entity == null) {
            throw new NotFoundException("Runner not registered");
        }
        return entity;
    }

    private LocalRunnerTaskEntity requireTask(String runId) {
        String normalized = requireText(runId, "runId cannot be blank");
        LocalRunnerTaskEntity entity = taskMapper.selectOne(new LambdaQueryWrapper<LocalRunnerTaskEntity>()
                .eq(LocalRunnerTaskEntity::getRunId, normalized)
                .last("LIMIT 1"));
        if (entity == null) {
            throw new NotFoundException("Runner task not found");
        }
        return entity;
    }

    private void validateRunnerToken(LocalRunnerNodeEntity runner, String token) {
        String expected = blankToNull(runner.getRunnerToken());
        if (expected != null && !expected.equals(blankToNull(token))) {
            throw new BadRequestException("Runner token is invalid");
        }
    }

    private void validateExecutionToken(LocalRunnerTaskEntity task, String runnerId, String token) {
        if (!task.getExecutionToken().equals(blankToNull(token))) {
            throw new BadRequestException("Task execution token is invalid or expired");
        }
        String taskRunnerId = blankToNull(task.getRunnerId());
        if (taskRunnerId != null && !taskRunnerId.equals(blankToNull(runnerId))) {
            throw new BadRequestException("Task is assigned to another runner");
        }
    }

    private void touchTaskReportTime(LocalRunnerTaskEntity task) {
        task.setLastReportedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        taskMapper.updateById(task);
    }

    private boolean isTerminalStatus(String status) {
        return TERMINAL_STATUSES.contains(status);
    }

    private String normalizeStatus(String status, String fallback) {
        String normalized = blankToNull(status);
        return normalized == null ? fallback : normalized.toUpperCase();
    }

    private String resolveRunnerName(Map<String, Object> machineHint, String fallback) {
        if (machineHint != null) {
            Object name = machineHint.get("deviceName");
            if (name instanceof String text && blankToNull(text) != null) {
                return text.trim();
            }
        }
        return fallback;
    }

    private String requireText(String value, String message) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            throw new BadRequestException(message);
        }
        return normalized;
    }

    private String blankToDefault(String value, String fallback) {
        String normalized = blankToNull(value);
        return normalized == null ? fallback : normalized;
    }

    private String blankToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private int defaultNumber(Integer value) {
        return value == null ? 0 : value;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("Runner task JSON serialization failed");
        }
    }

    private Map<String, Object> readMap(String json) {
        String normalized = blankToNull(json);
        if (normalized == null) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(normalized, new TypeReference<Map<String, Object>>() {
            });
        } catch (JsonProcessingException exception) {
            return Map.of();
        }
    }

    private List<Map<String, Object>> readListMap(String json) {
        String normalized = blankToNull(json);
        if (normalized == null) {
            return List.of();
        }
        try {
            return objectMapper.readValue(normalized, new TypeReference<List<Map<String, Object>>>() {
            });
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }
}
