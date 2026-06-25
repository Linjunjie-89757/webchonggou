package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.workspace.WorkspaceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.ApiRunRequest;

@Component
public class ApiExecutionSuiteScheduler {

    private static final Logger log = LoggerFactory.getLogger(ApiExecutionSuiteScheduler.class);

    private final ApiExecutionSuiteMapper suiteMapper;
    private final ApiExecutionSuiteDomainService suiteDomainService;
    private final WorkspaceService workspaceService;
    private final Set<Long> runningSuiteIds = ConcurrentHashMap.newKeySet();

    public ApiExecutionSuiteScheduler(
            ApiExecutionSuiteMapper suiteMapper,
            ApiExecutionSuiteDomainService suiteDomainService,
            WorkspaceService workspaceService
    ) {
        this.suiteMapper = suiteMapper;
        this.suiteDomainService = suiteDomainService;
        this.workspaceService = workspaceService;
    }

    @Scheduled(fixedDelayString = "${automation.api.execution-suite.schedule-scan-delay-ms:30000}")
    public void scanAndRunDueSuites() {
        LocalDateTime now = LocalDateTime.now();
        suiteMapper.selectList(new LambdaQueryWrapper<ApiExecutionSuiteEntity>()
                        .eq(ApiExecutionSuiteEntity::getScheduleEnabled, true)
                        .eq(ApiExecutionSuiteEntity::getStatus, "ACTIVE"))
                .stream()
                .filter(suite -> isDue(suite, now))
                .forEach(suite -> runDueSuite(suite, now));
    }

    private boolean isDue(ApiExecutionSuiteEntity suite, LocalDateTime now) {
        String expression = suite.getCronExpression();
        if (expression == null || expression.isBlank()) {
            return false;
        }
        CronExpression cron;
        try {
            cron = CronExpression.parse(expression.trim());
        } catch (IllegalArgumentException exception) {
            log.warn("Invalid execution suite cron expression. suiteId={}, cron={}", suite.getId(), expression);
            return false;
        }
        LocalDateTime baseline = suite.getLastRunAt();
        if (baseline == null) {
            baseline = suite.getUpdatedAt() == null ? suite.getCreatedAt() : suite.getUpdatedAt();
        }
        if (baseline == null) {
            baseline = now.minusMinutes(1);
        }
        LocalDateTime next = cron.next(baseline);
        return next != null && !next.isAfter(now);
    }

    private void runDueSuite(ApiExecutionSuiteEntity suite, LocalDateTime now) {
        if (!runningSuiteIds.add(suite.getId())) {
            return;
        }
        try {
            suiteDomainService.runSuite(
                    suite.getId(),
                    suiteWorkspaceCode(suite),
                    new ApiRunRequest(null, suite.getEnvironmentId(), suite.getVariableSetId(), suite.getBranchName(), "SCHEDULE")
            );
        } catch (BadRequestException exception) {
            log.warn("Scheduled execution suite skipped. suiteId={}, message={}", suite.getId(), exception.getMessage());
        } catch (RuntimeException exception) {
            log.error("Scheduled execution suite failed. suiteId={}", suite.getId(), exception);
        } finally {
            runningSuiteIds.remove(suite.getId());
        }
    }

    private String suiteWorkspaceCode(ApiExecutionSuiteEntity suite) {
        return workspaceService.requireWorkspaceById(suite.getWorkspaceId()).getWorkspaceCode();
    }
}
