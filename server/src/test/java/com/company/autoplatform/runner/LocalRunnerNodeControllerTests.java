package com.company.autoplatform.runner;

import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocalRunnerNodeControllerTests {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listNodesRequiresUserAndUsesDefaultOfflineThreshold() {
        LocalRunnerService localRunnerService = mock(LocalRunnerService.class);
        when(localRunnerService.listRunnerNodes(Duration.ofMinutes(2), null, null)).thenReturn(List.of());
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                11L,
                "zhangli",
                "Zhang Li",
                "{noop}123456",
                PlatformRole.PLATFORM_ADMIN,
                1
        );
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                principal,
                principal.getPassword(),
                principal.getAuthorities()
        ));

        LocalRunnerNodeController controller = new LocalRunnerNodeController(localRunnerService);
        var response = controller.listNodes(null, null);

        assertThat(response.data()).isEmpty();
        verify(localRunnerService).listRunnerNodes(Duration.ofMinutes(2), null, null);
    }

    @Test
    void listNodesForwardsTaskTypeAndResourceCostFilters() {
        LocalRunnerService localRunnerService = mock(LocalRunnerService.class);
        when(localRunnerService.listRunnerNodes(Duration.ofMinutes(2), "WEB_CASE_RUN", 5)).thenReturn(List.of());
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                11L,
                "zhangli",
                "Zhang Li",
                "{noop}123456",
                PlatformRole.PLATFORM_ADMIN,
                1
        );
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                principal,
                principal.getPassword(),
                principal.getAuthorities()
        ));

        LocalRunnerNodeController controller = new LocalRunnerNodeController(localRunnerService);
        var response = controller.listNodes("WEB_CASE_RUN", 5);

        assertThat(response.data()).isEmpty();
        verify(localRunnerService).listRunnerNodes(Duration.ofMinutes(2), "WEB_CASE_RUN", 5);
    }
}
