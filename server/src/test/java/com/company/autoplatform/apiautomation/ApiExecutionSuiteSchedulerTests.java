package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.auth.PlatformUserDetailsService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ApiExecutionSuiteSchedulerTests {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void scheduledSuiteRunsWithSystemAuthenticationWhenNoRequestUserExists() {
        ApiExecutionSuiteMapper suiteMapper = mock(ApiExecutionSuiteMapper.class);
        ApiExecutionSuiteDomainService suiteDomainService = mock(ApiExecutionSuiteDomainService.class);
        WorkspaceService workspaceService = mock(WorkspaceService.class);
        PlatformUserDetailsService userDetailsService = mock(PlatformUserDetailsService.class);

        ApiExecutionSuiteEntity suite = new ApiExecutionSuiteEntity();
        suite.setId(42L);
        suite.setWorkspaceId(7L);
        suite.setEnvironmentId(9L);
        suite.setVariableSetId(10L);
        suite.setStatus("ACTIVE");
        suite.setScheduleEnabled(true);
        suite.setCronExpression("0 */5 * * * ?");
        suite.setLastRunAt(LocalDateTime.now().minusMinutes(10));

        WorkspaceEntity workspace = new WorkspaceEntity();
        workspace.setId(7L);
        workspace.setWorkspaceCode("risk-ops");
        workspace.setWorkspaceName("Risk Ops");

        when(suiteMapper.selectList(any())).thenReturn(List.of(suite));
        when(workspaceService.requireWorkspaceById(7L)).thenReturn(workspace);
        when(userDetailsService.loadUserByUsername("superadmin")).thenReturn(new CurrentUserPrincipal(
                1L,
                "superadmin",
                "Super Admin",
                "{noop}superadmin123",
                PlatformRole.SUPER_ADMIN,
                1
        ));
        AtomicBoolean ranWithUser = new AtomicBoolean(false);
        when(suiteDomainService.runSuite(any(), any(), any())).thenAnswer(invocation -> {
            assertNotNull(CurrentUserContext.require());
            ranWithUser.set(true);
            return null;
        });

        SecurityContextHolder.clearContext();

        new ApiExecutionSuiteScheduler(suiteMapper, suiteDomainService, workspaceService, userDetailsService, "superadmin")
                .scanAndRunDueSuites();

        verify(suiteDomainService).runSuite(any(), any(), any());
        assertTrue(ranWithUser.get());
    }
}
