# Web UI Automation Phase 2 Execution Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Web UI automation execution loop: run/debug cases with Playwright, persist run/step/artifact results, and show run history/report detail in the frontend.

**Architecture:** Extend the existing phase 1 Web UI automation module instead of creating a separate subsystem. Backend execution stays synchronous for phase 2, with a small `WebUiBrowserRunner` boundary so controller/persistence tests can use a fake runner while production uses Playwright Java. Frontend extends the current `/automation/web` workspace with run actions, a run-history tab, and a run-detail drawer.

**Tech Stack:** Spring Boot 3.5, MyBatis Plus, Flyway, Playwright Java, Vue 3, TypeScript, Element Plus.

---

## File Structure

Backend worktree:

```text
C:/Users/20245/.config/superpowers/worktrees/auto/codex-web-ui-assets-backend
```

Frontend worktree:

```text
C:/Users/20245/.config/superpowers/worktrees/perfectprojectwebchonggou-main/codex-web-ui-assets-frontend
```

Backend files to create:

```text
server/src/main/resources/db/migration/V48__add_web_ui_execution_tables.sql
server/src/main/resources/db/migration-mysql/V48__add_web_ui_execution_tables.sql
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunEntity.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunStepEntity.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunArtifactEntity.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunMapper.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunStepMapper.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunArtifactMapper.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiBrowserRunner.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiPlaywrightBrowserRunner.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiLocatorSupport.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiExecutionEngineSupport.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiExecutionDomainService.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunResultPersistenceSupport.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiArtifactStorageService.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiArtifactFileDownload.java
server/src/test/java/com/company/autoplatform/webuiautomation/WebUiExecutionControllerIntegrationTests.java
server/src/test/java/com/company/autoplatform/webuiautomation/WebUiExecutionSupportTests.java
```

Backend files to modify:

```text
server/pom.xml
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationController.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationService.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationModels.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationFormatSupport.java
server/src/main/java/com/company/autoplatform/webuiautomation/WebUiCaseDomainService.java
```

Frontend files to create:

```text
src/features/web-ui-case-run/runWebUiCase.ts
src/features/web-ui-case-run/index.ts
src/entities/web-ui-automation/ui/WebUiRunStatusBadge.vue
src/widgets/web-ui-case-workspace/WebUiRunDetailDrawer.vue
```

Frontend files to modify:

```text
src/entities/web-ui-automation/model/types.ts
src/entities/web-ui-automation/model/options.ts
src/entities/web-ui-automation/lib/format.ts
src/entities/web-ui-automation/api/webUiAutomationApi.ts
src/entities/web-ui-automation/index.ts
src/widgets/web-ui-case-workspace/WebUiCaseWorkspace.vue
src/widgets/web-ui-case-workspace/WebUiCaseEditorDrawer.vue
```

---

## Task 1: Backend Execution Tables, Entities, and Models

**Files:**
- Create: `server/src/main/resources/db/migration/V48__add_web_ui_execution_tables.sql`
- Create: `server/src/main/resources/db/migration-mysql/V48__add_web_ui_execution_tables.sql`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunEntity.java`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunStepEntity.java`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunArtifactEntity.java`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunMapper.java`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunStepMapper.java`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunArtifactMapper.java`
- Modify: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationModels.java`
- Modify: `server/pom.xml`
- Test: `server/src/test/java/com/company/autoplatform/webuiautomation/WebUiAutomationControllerIntegrationTests.java`

- [ ] **Step 1: Add failing API-shape assertions for run models**

Extend `WebUiAutomationControllerIntegrationTests` with a test that calls the future run list endpoint before it exists:

```java
@Test
void listRunsReturnsEmptyPageBeforeAnyExecution() throws Exception {
    mockMvc.perform(get("/api/automation/web/runs")
                    .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                    .param("pageNo", "1")
                    .param("pageSize", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.items.length()").value(0))
            .andExpect(jsonPath("$.data.total").value(0));
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
mvn -Dtest=WebUiAutomationControllerIntegrationTests#listRunsReturnsEmptyPageBeforeAnyExecution test
```

Expected: fail with 404 because `/api/automation/web/runs` is not implemented yet.

- [ ] **Step 3: Add Playwright Java dependency**

In `server/pom.xml`, add:

```xml
<dependency>
    <groupId>com.microsoft.playwright</groupId>
    <artifactId>playwright</artifactId>
    <version>1.49.0</version>
</dependency>
```

Place it near the other runtime libraries, after `jsoup` is fine.

- [ ] **Step 4: Add H2 migration**

Create `server/src/main/resources/db/migration/V48__add_web_ui_execution_tables.sql`:

```sql
CREATE TABLE IF NOT EXISTS web_ui_run (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    case_id BIGINT NULL,
    case_name VARCHAR(255) NOT NULL,
    environment_id BIGINT NULL,
    environment_name VARCHAR(255) NULL,
    status VARCHAR(32) NOT NULL,
    browser_type VARCHAR(32) NOT NULL,
    headless BOOLEAN NOT NULL DEFAULT TRUE,
    base_url VARCHAR(1024) NULL,
    total_steps INT NOT NULL DEFAULT 0,
    passed_steps INT NOT NULL DEFAULT 0,
    failed_steps INT NOT NULL DEFAULT 0,
    skipped_steps INT NOT NULL DEFAULT 0,
    duration_ms BIGINT NULL,
    failure_summary VARCHAR(2048) NULL,
    operator_name VARCHAR(128) NULL,
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_web_ui_run_workspace ON web_ui_run(workspace_id);
CREATE INDEX IF NOT EXISTS idx_web_ui_run_case ON web_ui_run(case_id);
CREATE INDEX IF NOT EXISTS idx_web_ui_run_status ON web_ui_run(status);

CREATE TABLE IF NOT EXISTS web_ui_run_step (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id BIGINT NOT NULL,
    case_step_id BIGINT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    locator_type VARCHAR(64) NULL,
    locator_value VARCHAR(2048) NULL,
    input_value_snapshot CLOB NULL,
    duration_ms BIGINT NULL,
    error_message CLOB NULL,
    screenshot_artifact_id BIGINT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_web_ui_run_step_run ON web_ui_run_step(run_id);

CREATE TABLE IF NOT EXISTS web_ui_run_artifact (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    run_id BIGINT NOT NULL,
    step_id BIGINT NULL,
    artifact_type VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(128) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    storage_path VARCHAR(1024) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_web_ui_run_artifact_run ON web_ui_run_artifact(run_id);
CREATE INDEX IF NOT EXISTS idx_web_ui_run_artifact_workspace ON web_ui_run_artifact(workspace_id);
```

- [ ] **Step 5: Add MySQL migration**

Create `server/src/main/resources/db/migration-mysql/V48__add_web_ui_execution_tables.sql`:

```sql
CREATE TABLE IF NOT EXISTS web_ui_run (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    case_id BIGINT NULL,
    case_name VARCHAR(255) NOT NULL,
    environment_id BIGINT NULL,
    environment_name VARCHAR(255) NULL,
    status VARCHAR(32) NOT NULL,
    browser_type VARCHAR(32) NOT NULL,
    headless TINYINT(1) NOT NULL DEFAULT 1,
    base_url VARCHAR(1024) NULL,
    total_steps INT NOT NULL DEFAULT 0,
    passed_steps INT NOT NULL DEFAULT 0,
    failed_steps INT NOT NULL DEFAULT 0,
    skipped_steps INT NOT NULL DEFAULT 0,
    duration_ms BIGINT NULL,
    failure_summary VARCHAR(2048) NULL,
    operator_name VARCHAR(128) NULL,
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_web_ui_run_workspace (workspace_id),
    INDEX idx_web_ui_run_case (case_id),
    INDEX idx_web_ui_run_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS web_ui_run_step (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_id BIGINT NOT NULL,
    case_step_id BIGINT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    locator_type VARCHAR(64) NULL,
    locator_value VARCHAR(2048) NULL,
    input_value_snapshot TEXT NULL,
    duration_ms BIGINT NULL,
    error_message TEXT NULL,
    screenshot_artifact_id BIGINT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_web_ui_run_step_run (run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS web_ui_run_artifact (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    run_id BIGINT NOT NULL,
    step_id BIGINT NULL,
    artifact_type VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(128) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    storage_path VARCHAR(1024) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_web_ui_run_artifact_run (run_id),
    INDEX idx_web_ui_run_artifact_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 6: Add entity and mapper classes**

Use the phase 1 entity style. Each entity uses `@TableName` and Lombok `@Data`.

Create `WebUiRunMapper.java`:

```java
package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WebUiRunMapper extends BaseMapper<WebUiRunEntity> {
}
```

Create equivalent mappers for `WebUiRunStepEntity` and `WebUiRunArtifactEntity`.

- [ ] **Step 7: Add response/request records**

In `WebUiAutomationModels.java`, add records:

```java
public record WebUiRunRequest(
        Long environmentId,
        Boolean headless
) {
}

public record DebugRunWebUiCaseRequest(
        Long caseId,
        Long environmentId,
        String workspaceCode,
        String moduleName,
        @NotBlank(message = "Case name cannot be blank") String caseName,
        String description,
        String baseUrl,
        String browserType,
        Boolean headless,
        Integer defaultTimeoutMs,
        String status,
        List<@Valid SaveWebUiCaseStepRequest> steps
) {
}

public record WebUiRunSummary(
        Long id,
        String workspaceCode,
        String workspaceName,
        Long caseId,
        String caseName,
        Long environmentId,
        String environmentName,
        String status,
        String browserType,
        Boolean headless,
        String baseUrl,
        Long durationMs,
        String failureSummary,
        Integer totalSteps,
        Integer passedSteps,
        Integer failedSteps,
        Integer skippedSteps,
        String operatorName,
        LocalDateTime startedAt,
        LocalDateTime finishedAt,
        LocalDateTime createdAt
) {
}

public record WebUiRunStepResult(
        Long id,
        Long caseStepId,
        String stepName,
        String stepType,
        String status,
        String locatorType,
        String locatorValue,
        String inputValueSnapshot,
        Long durationMs,
        String errorMessage,
        Long screenshotArtifactId,
        String screenshotUrl,
        Integer sortOrder,
        LocalDateTime startedAt,
        LocalDateTime finishedAt
) {
}

public record WebUiRunDetail(
        WebUiRunSummary summary,
        List<WebUiRunStepResult> steps
) {
}

public record WebUiRunResponse(
        Long runId,
        Long caseId,
        String caseName,
        String status,
        Long durationMs,
        String failureSummary,
        Integer totalSteps,
        Integer passedSteps,
        Integer failedSteps,
        Integer skippedSteps,
        List<WebUiRunStepResult> stepResults
) {
}
```

- [ ] **Step 8: Run compile and verify GREEN for model layer**

Run:

```powershell
mvn -DskipTests compile
```

Expected: build succeeds after adding entities, mappers, migrations, and model records.

---

## Task 2: Backend Execution Support and Fake-Runner TDD

**Files:**
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiBrowserRunner.java`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiLocatorSupport.java`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiExecutionEngineSupport.java`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunResultPersistenceSupport.java`
- Modify: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationFormatSupport.java`
- Test: `server/src/test/java/com/company/autoplatform/webuiautomation/WebUiExecutionSupportTests.java`

- [ ] **Step 1: Write failing unit tests for URL and role parsing**

Create `WebUiExecutionSupportTests.java`:

```java
package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.common.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WebUiExecutionSupportTests {

    private final WebUiLocatorSupport locatorSupport = new WebUiLocatorSupport();

    @Test
    void resolveUrlUsesAbsoluteInputDirectly() {
        assertThat(WebUiExecutionEngineSupport.resolveOpenUrl("https://example.com/login", "https://base.test"))
                .isEqualTo("https://example.com/login");
    }

    @Test
    void resolveUrlCombinesBaseUrlAndRelativePath() {
        assertThat(WebUiExecutionEngineSupport.resolveOpenUrl("/login", "https://base.test/app"))
                .isEqualTo("https://base.test/login");
    }

    @Test
    void resolveUrlRejectsRelativePathWithoutBaseUrl() {
        assertThatThrownBy(() -> WebUiExecutionEngineSupport.resolveOpenUrl("/login", null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Base URL");
    }

    @Test
    void parseRoleLocatorRequiresRoleAndName() {
        WebUiLocatorSupport.RoleLocator locator = locatorSupport.parseRoleLocator("button:Login");

        assertThat(locator.role()).isEqualTo("button");
        assertThat(locator.name()).isEqualTo("Login");
    }

    @Test
    void parseRoleLocatorRejectsInvalidFormat() {
        assertThatThrownBy(() -> locatorSupport.parseRoleLocator("button"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ROLE locator");
    }
}
```

- [ ] **Step 2: Run test and verify RED**

Run:

```powershell
mvn -Dtest=WebUiExecutionSupportTests test
```

Expected: fail because `WebUiLocatorSupport` and `resolveOpenUrl` do not exist.

- [ ] **Step 3: Implement locator and URL support**

Create `WebUiLocatorSupport` with `parseRoleLocator(String value)` and `record RoleLocator(String role, String name)`.

Add a static package-visible method in `WebUiExecutionEngineSupport`:

```java
static String resolveOpenUrl(String inputValue, String baseUrl) {
    String input = WebUiAutomationFormatSupport.blankToNull(inputValue);
    if (input == null) {
        throw new BadRequestException("OPEN step URL cannot be blank");
    }
    if (input.startsWith("http://") || input.startsWith("https://")) {
        return input;
    }
    String base = WebUiAutomationFormatSupport.blankToNull(baseUrl);
    if (base == null) {
        throw new BadRequestException("Base URL is required for relative OPEN step URL");
    }
    try {
        return java.net.URI.create(base).resolve(input).toString();
    } catch (IllegalArgumentException exception) {
        throw new BadRequestException("OPEN step URL is invalid");
    }
}
```

- [ ] **Step 4: Add runner boundary**

Create `WebUiBrowserRunner.java`:

```java
package com.company.autoplatform.webuiautomation;

import java.util.List;

public interface WebUiBrowserRunner {

    List<StepExecutionResult> run(WebUiRunContext context);

    record WebUiRunContext(
            String browserType,
            boolean headless,
            String baseUrl,
            int defaultTimeoutMs,
            List<WebUiCaseStepEntity> steps
    ) {
    }

    record StepExecutionResult(
            WebUiCaseStepEntity step,
            boolean success,
            long durationMs,
            String errorMessage,
            byte[] screenshotBytes
    ) {
    }
}
```

- [ ] **Step 5: Run unit test and verify GREEN**

Run:

```powershell
mvn -Dtest=WebUiExecutionSupportTests test
```

Expected: all tests pass.

---

## Task 3: Backend Run Endpoints, Persistence, and Controller Tests

**Files:**
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiExecutionDomainService.java`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiRunResultPersistenceSupport.java`
- Modify: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationController.java`
- Modify: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationService.java`
- Modify: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiCaseDomainService.java`
- Test: `server/src/test/java/com/company/autoplatform/webuiautomation/WebUiExecutionControllerIntegrationTests.java`

- [ ] **Step 1: Write failing integration tests with fake runner**

Create `WebUiExecutionControllerIntegrationTests.java` with a test configuration that supplies a fake `WebUiBrowserRunner`.

Key test cases:

```java
@Test
void runCasePersistsSuccessRunAndUpdatesCaseLastRun() throws Exception {
    Long caseId = createCase(uniquePrefix("success"), List.of(
            openStep("Open page", "https://example.com", 1),
            screenshotStep("Capture", 2)
    ));

    mockMvc.perform(post("/api/automation/web/cases/{id}/run", caseId)
                    .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("SUCCESS"))
            .andExpect(jsonPath("$.data.totalSteps").value(2))
            .andExpect(jsonPath("$.data.passedSteps").value(2));

    mockMvc.perform(get("/api/automation/web/cases/{id}", caseId)
                    .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.lastRunResult").value("SUCCESS"));
}

@Test
void failedStepSkipsRemainingStepsWhenContinueOnFailureIsFalse() throws Exception {
    Long caseId = createCase(uniquePrefix("failed"), List.of(
            clickStep("Click missing", "CSS", "#missing", false, 1),
            screenshotStep("Should skip", 2)
    ));

    mockMvc.perform(post("/api/automation/web/cases/{id}/run", caseId)
                    .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("FAILED"))
            .andExpect(jsonPath("$.data.failedSteps").value(1))
            .andExpect(jsonPath("$.data.skippedSteps").value(1));
}

@Test
void runCaseRejectsNoEnabledSteps() throws Exception {
    Long caseId = createCase(uniquePrefix("empty"), List.of(
            disabledOpenStep("Disabled", "https://example.com", 1)
    ));

    mockMvc.perform(post("/api/automation/web/cases/{id}/run", caseId)
                    .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false));
}
```

The fake runner should return failure for locator value `#missing` and success otherwise.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
mvn -Dtest=WebUiExecutionControllerIntegrationTests test
```

Expected: fail because run endpoints and services do not exist.

- [ ] **Step 3: Implement service/controller methods**

Add controller methods:

```java
@PostMapping("/cases/{id}/run")
public ApiResponse<WebUiRunResponse> runCase(...)

@PostMapping("/cases/debug-run")
public ApiResponse<WebUiRunResponse> debugRunCase(...)

@GetMapping("/runs")
public ApiResponse<PageResponse<WebUiRunSummary>> listRuns(...)

@GetMapping("/runs/{id}")
public ApiResponse<WebUiRunDetail> getRun(...)
```

Delegate through `WebUiAutomationService` to `WebUiExecutionDomainService`.

- [ ] **Step 4: Implement persistence and result summary**

`WebUiRunResultPersistenceSupport` should:

- create a `RUNNING` row before browser execution,
- insert a row per executed step,
- insert `SKIPPED` rows for remaining enabled steps after a stop-on-failure step,
- update counts, status, duration, and failure summary,
- update case `lastRunResult` and `lastRunAt` for saved-case runs.

- [ ] **Step 5: Implement list/detail mapping**

Run list uses `workspaceScopeSupport.resolveReadableWorkspaces(workspaceCode)` like phase 1 list queries.

Run detail:

- validates readable workspace,
- loads steps ordered by `sortOrder`,
- includes `screenshotUrl` as `/api/automation/web/runs/{runId}/artifacts/{artifactId}/download` when screenshot exists.

- [ ] **Step 6: Run integration tests and verify GREEN**

Run:

```powershell
mvn -Dtest=WebUiExecutionControllerIntegrationTests test
```

Expected: tests pass.

---

## Task 4: Playwright Runner and Screenshot Artifact Download

**Files:**
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiPlaywrightBrowserRunner.java`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiArtifactStorageService.java`
- Create: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiArtifactFileDownload.java`
- Modify: `server/src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationController.java`
- Test: `server/src/test/java/com/company/autoplatform/webuiautomation/WebUiExecutionControllerIntegrationTests.java`

- [ ] **Step 1: Write failing artifact access test**

Add test:

```java
@Test
void artifactDownloadRequiresArtifactToBelongToRun() throws Exception {
    mockMvc.perform(get("/api/automation/web/runs/{runId}/artifacts/{artifactId}/download", 999999, 888888)
                    .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
            .andExpect(status().isNotFound());
}
```

Run:

```powershell
mvn -Dtest=WebUiExecutionControllerIntegrationTests#artifactDownloadRequiresArtifactToBelongToRun test
```

Expected: fail because endpoint does not exist.

- [ ] **Step 2: Implement artifact storage**

`WebUiArtifactStorageService` should mirror the existing report attachment storage pattern but store generated screenshot bytes instead of uploaded multipart files.

Public methods:

```java
StoredArtifact storeScreenshot(Long workspaceId, Long runId, Long stepId, byte[] bytes)
WebUiArtifactFileDownload load(WebUiRunArtifactEntity artifact)
void delete(String storagePath)
```

Use max size `5 * 1024 * 1024L`, content type `image/png`, extension `.png`.

- [ ] **Step 3: Implement artifact download endpoint**

Add:

```java
@GetMapping("/runs/{runId}/artifacts/{artifactId}/download")
public ResponseEntity<Resource> downloadRunArtifact(...)
```

Return `Content-Disposition: inline` or attachment with UTF-8 filename. Validate run and artifact workspace ownership before returning file.

- [ ] **Step 4: Implement production Playwright runner**

`WebUiPlaywrightBrowserRunner` maps:

```text
OPEN            page.navigate(url)
CLICK           locator.click()
FILL            locator.fill(inputValue)
CLEAR           locator.clear()
WAIT_FOR        locator.waitFor()
ASSERT_VISIBLE  if (!locator.isVisible()) fail
ASSERT_TEXT     locator.textContent() contains inputValue
SCREENSHOT      page.screenshot()
```

Use `WebUiLocatorSupport` for locator conversion. Catch runtime Playwright errors and return failed `StepExecutionResult` instead of leaking Playwright exception types into domain service.

- [ ] **Step 5: Run compile and targeted tests**

Run:

```powershell
mvn -Dtest=WebUiExecutionSupportTests,WebUiExecutionControllerIntegrationTests test
mvn -DskipTests compile
```

Expected: tests and compile pass.

---

## Task 5: Frontend Types, API Client, and Run Feature

**Files:**
- Create: `src/features/web-ui-case-run/runWebUiCase.ts`
- Create: `src/features/web-ui-case-run/index.ts`
- Create: `src/entities/web-ui-automation/ui/WebUiRunStatusBadge.vue`
- Modify: `src/entities/web-ui-automation/model/types.ts`
- Modify: `src/entities/web-ui-automation/model/options.ts`
- Modify: `src/entities/web-ui-automation/lib/format.ts`
- Modify: `src/entities/web-ui-automation/api/webUiAutomationApi.ts`
- Modify: `src/entities/web-ui-automation/index.ts`

- [ ] **Step 1: Add run types**

In `types.ts`, add:

```ts
export type WebUiRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELED'
export type WebUiRunStepStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED'

export interface WebUiRunRequest {
  environmentId?: number | null
  headless?: boolean | null
}

export interface WebUiRunStepResult {
  id: number
  caseStepId: number | null
  stepName: string
  stepType: WebUiStepType
  status: WebUiRunStepStatus
  locatorType: WebUiLocatorType | null
  locatorValue: string | null
  inputValueSnapshot: string | null
  durationMs: number | null
  errorMessage: string | null
  screenshotArtifactId: number | null
  screenshotUrl: string | null
  sortOrder: number
  startedAt: string | null
  finishedAt: string | null
}

export interface WebUiRunSummary {
  id: number
  workspaceCode: string
  workspaceName: string | null
  caseId: number | null
  caseName: string
  environmentId: number | null
  environmentName: string | null
  status: WebUiRunStatus
  browserType: WebUiBrowserType
  headless: boolean
  baseUrl: string | null
  durationMs: number | null
  failureSummary: string | null
  totalSteps: number
  passedSteps: number
  failedSteps: number
  skippedSteps: number
  operatorName: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string | null
}

export interface WebUiRunDetail {
  summary: WebUiRunSummary
  steps: WebUiRunStepResult[]
}

export interface WebUiRunResponse {
  runId: number
  caseId: number | null
  caseName: string
  status: WebUiRunStatus
  durationMs: number | null
  failureSummary: string | null
  totalSteps: number
  passedSteps: number
  failedSteps: number
  skippedSteps: number
  stepResults: WebUiRunStepResult[]
}

export interface WebUiRunListQuery {
  caseId?: number | null
  keyword?: string
  status?: WebUiRunStatus | ''
  pageNo?: number
  pageSize?: number
}
```

- [ ] **Step 2: Add format helpers and badge**

Add status metadata in `format.ts`:

```ts
export function getWebUiRunStatusMeta(status?: string | null) {
  const normalized = (status || '').toUpperCase()
  const map = {
    RUNNING: { label: '执行中', type: 'warning' },
    SUCCESS: { label: '成功', type: 'success' },
    FAILED: { label: '失败', type: 'danger' },
    CANCELED: { label: '已取消', type: 'info' },
  } as const
  return map[normalized as keyof typeof map] || { label: normalized || '未执行', type: 'info' }
}
```

Create `WebUiRunStatusBadge.vue` using Element Plus `el-tag`.

- [ ] **Step 3: Extend API client**

Add methods:

```ts
runCase(workspaceCode: string, id: number, data?: WebUiRunRequest): Promise<WebUiRunResponse>
debugRunCase(workspaceCode: string, data: SaveWebUiCasePayload & WebUiRunRequest & { caseId?: number | null }): Promise<WebUiRunResponse>
getRuns(workspaceCode: string, query?: WebUiRunListQuery): Promise<PageResponse<WebUiRunSummary>>
getRunDetail(workspaceCode: string, id: number): Promise<WebUiRunDetail>
```

Normalize numeric fields with `Number(...)`, null string fields to `null`, and arrays defensively.

- [ ] **Step 4: Add run feature wrapper**

Create `runWebUiCase.ts`:

```ts
import { ElMessage } from 'element-plus'
import { webUiAutomationApi, type WebUiCaseItem, type WebUiRunResponse } from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'

export async function runWebUiCase(caseItem: WebUiCaseItem, workspaceCode: string): Promise<WebUiRunResponse | null> {
  try {
    const result = await webUiAutomationApi.runCase(workspaceCode, caseItem.id, {})
    ElMessage.success(result.status === 'SUCCESS' ? '执行成功' : '执行完成，请查看报告')
    return result
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    return null
  }
}
```

- [ ] **Step 5: Run frontend typecheck**

Run:

```powershell
npm.cmd run typecheck
```

Expected: pass after exports and API methods are wired.

---

## Task 6: Frontend Workspace Run History and Detail Drawer

**Files:**
- Create: `src/widgets/web-ui-case-workspace/WebUiRunDetailDrawer.vue`
- Modify: `src/widgets/web-ui-case-workspace/WebUiCaseWorkspace.vue`
- Modify: `src/widgets/web-ui-case-workspace/WebUiCaseEditorDrawer.vue`

- [ ] **Step 1: Add run state to workspace**

In `WebUiCaseWorkspace.vue`, add state:

```ts
const activeTab = ref<'cases' | 'runs' | 'environments'>('cases')
const runs = ref<WebUiRunSummary[]>([])
const runListTotal = ref(0)
const loadingRuns = ref(false)
const runningCaseId = ref<number | null>(null)
const runDetailVisible = ref(false)
const selectedRunId = ref<number | null>(null)
const runPageNo = ref(1)
const runPageSize = ref(10)
```

Add `loadRuns`, `openRunDetail`, `handleRunCase`, and request sequence checks matching existing case list patterns.

- [ ] **Step 2: Add run actions to case table**

Change row actions to include:

```vue
<el-button :loading="runningCaseId === row.id" link type="primary" @click="handleRunCase(row)">运行</el-button>
<el-button link type="primary" :disabled="!row.lastRunAt" @click="openLatestRunForCase(row)">报告</el-button>
```

Keep edit/copy/delete behavior unchanged.

- [ ] **Step 3: Add execution history tab**

Add `el-tab-pane name="runs" label="执行记录"` with table columns:

```text
caseName
status
environmentName
browserType
headless
durationMs
passedSteps/failedSteps/skippedSteps
failureSummary
operatorName
startedAt
actions
```

Use `WebUiRunStatusBadge`, `formatBrowserType`, `formatWebUiDateTime`, and a duration formatter.

- [ ] **Step 4: Build run detail drawer**

`WebUiRunDetailDrawer.vue` props:

```ts
defineProps<{
  modelValue: boolean
  workspaceCode: string
  runId: number | null
}>()
```

Behavior:

- loads detail when opened with a run id,
- shows summary block,
- shows step table ordered by `sortOrder`,
- renders screenshot link when `screenshotUrl` exists,
- ignores stale responses when drawer is closed or run id changes.

- [ ] **Step 5: Add debug-run entry in editor drawer**

Add a drawer footer button:

```text
调试运行
```

It should:

- validate current form and steps,
- call `webUiAutomationApi.debugRunCase`,
- emit an event such as `debug-run-finished` with `runId`,
- let workspace open run detail.

If this makes the editor drawer too large, keep the debug-run button but delegate API call to a small helper function inside the drawer.

- [ ] **Step 6: Run frontend verification**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Expected: both pass. Existing Rolldown `@vueuse/core` PURE annotation warning and chunk-size warning may remain non-blocking.

---

## Task 7: Final Backend and Frontend Verification

**Files:**
- Verify all changed backend and frontend files.

- [ ] **Step 1: Run backend targeted tests**

Run:

```powershell
mvn -Dtest=WebUiAutomationControllerIntegrationTests,WebUiExecutionSupportTests,WebUiExecutionControllerIntegrationTests test
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run backend compile**

Run:

```powershell
mvn -DskipTests compile
```

Expected: build success.

- [ ] **Step 3: Run frontend checks**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Expected: both pass; known existing build warnings may remain.

- [ ] **Step 4: Manual smoke when browser binaries are installed**

Run backend and frontend locally, then:

```text
1. Open /automation/web.
2. Create a case with OPEN https://example.com and ASSERT_TEXT Example Domain.
3. Click run.
4. Confirm a SUCCESS run appears.
5. Create a bad locator step and run again.
6. Confirm FAILED run, failed step message, skipped step rows, and screenshot link.
```

If Playwright browser binaries are missing, report that manual smoke is blocked and include the install command:

```powershell
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install chromium"
```

