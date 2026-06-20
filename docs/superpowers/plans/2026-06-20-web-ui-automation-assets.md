# Web UI Automation Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build target package 1 for Web UI automation: workspace-scoped Web UI cases, manual steps, and browser environment configuration, without adding Playwright execution yet.

**Architecture:** Add a backend `webuiautomation` package that follows the existing `apiautomation` MyBatis-Plus style, with independent tables for cases, steps, and environments. Add a frontend `web-ui-automation` entity plus `/automation/web` page widgets so users can list, create, edit, reorder, and delete Web UI cases and manage base environments.

**Tech Stack:** Spring Boot 3.5, Java 21, MyBatis-Plus, Flyway, H2/MySQL migrations, Vue 3, Vite, TypeScript, Element Plus.

---

## Scope

This plan implements only target package 1: the Web UI automation asset layer.

Included:

- Backend tables: `tb_web_ui_case`, `tb_web_ui_case_step`, `tb_web_ui_environment`.
- Backend CRUD APIs under `/api/automation/web`.
- Workspace scoping through `X-Workspace-Code`.
- Frontend entity API/types for Web UI automation.
- Frontend `/automation/web` real page replacing the placeholder.
- Case list, case editor with manual step table, delete confirmation.
- Environment list and editor.

Excluded from this package:

- Playwright dependency and browser execution.
- Run records, step results, screenshots, artifacts.
- Recording, AI generation, AI locator healing, scripts, suites, scheduled runs.

## File Map

Backend root: `D:\Project\auto\server`

- Create: `src/main/resources/db/migration/V47__add_web_ui_automation_asset_tables.sql`
- Create: `src/main/resources/db/migration-mysql/V47__add_web_ui_automation_asset_tables.sql`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationModels.java`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiCaseEntity.java`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiCaseStepEntity.java`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiEnvironmentEntity.java`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiCaseMapper.java`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiCaseStepMapper.java`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiEnvironmentMapper.java`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationFormatSupport.java`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiCaseDomainService.java`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiEnvironmentDomainService.java`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationService.java`
- Create: `src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationController.java`
- Create: `src/test/java/com/company/autoplatform/webuiautomation/WebUiAutomationControllerIntegrationTests.java`

Frontend root: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main`

- Create: `src/entities/web-ui-automation/model/types.ts`
- Create: `src/entities/web-ui-automation/model/options.ts`
- Create: `src/entities/web-ui-automation/lib/format.ts`
- Create: `src/entities/web-ui-automation/api/webUiAutomationApi.ts`
- Create: `src/entities/web-ui-automation/index.ts`
- Create: `src/entities/web-ui-automation/ui/WebUiCaseStatusBadge.vue`
- Create: `src/entities/web-ui-automation/ui/WebUiStepTypeBadge.vue`
- Create: `src/features/web-ui-case-delete/deleteWebUiCase.ts`
- Create: `src/features/web-ui-case-delete/index.ts`
- Create: `src/widgets/web-ui-case-workspace/WebUiCaseWorkspace.vue`
- Create: `src/widgets/web-ui-case-workspace/WebUiCaseEditorDrawer.vue`
- Create: `src/widgets/web-ui-case-workspace/WebUiEnvironmentPanel.vue`
- Create: `src/widgets/web-ui-case-workspace/index.ts`
- Create: `src/pages/automation-web/WebAutomationPage.vue`
- Modify: `src/app/router/index.ts`

---

### Task 1: Backend Migrations

**Files:**

- Create: `D:\Project\auto\server\src\main\resources\db\migration\V47__add_web_ui_automation_asset_tables.sql`
- Create: `D:\Project\auto\server\src\main\resources\db\migration-mysql\V47__add_web_ui_automation_asset_tables.sql`

- [ ] **Step 1: Add H2 migration**

Use this exact SQL for `src/main/resources/db/migration/V47__add_web_ui_automation_asset_tables.sql`:

```sql
CREATE TABLE IF NOT EXISTS tb_web_ui_case (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    module_name VARCHAR(255),
    case_name VARCHAR(255) NOT NULL,
    description TEXT,
    base_url VARCHAR(1000),
    browser_type VARCHAR(32) NOT NULL DEFAULT 'CHROMIUM',
    headless TINYINT(1) NOT NULL DEFAULT 1,
    default_timeout_ms INT NOT NULL DEFAULT 10000,
    status VARCHAR(32) NOT NULL DEFAULT 'ENABLED',
    last_run_result VARCHAR(32),
    last_run_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_web_ui_case_workspace ON tb_web_ui_case(workspace_id);
CREATE INDEX IF NOT EXISTS idx_web_ui_case_workspace_updated ON tb_web_ui_case(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS tb_web_ui_case_step (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type VARCHAR(32) NOT NULL,
    locator_type VARCHAR(32),
    locator_value VARCHAR(1000),
    input_value TEXT,
    timeout_ms INT NOT NULL DEFAULT 5000,
    continue_on_failure TINYINT(1) NOT NULL DEFAULT 0,
    screenshot_policy VARCHAR(32) NOT NULL DEFAULT 'ON_FAILURE',
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 10,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_web_ui_case_step_case ON tb_web_ui_case_step(case_id, sort_order);

CREATE TABLE IF NOT EXISTS tb_web_ui_environment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    environment_name VARCHAR(255) NOT NULL,
    base_url VARCHAR(1000) NOT NULL,
    browser_type VARCHAR(32) NOT NULL DEFAULT 'CHROMIUM',
    headless TINYINT(1) NOT NULL DEFAULT 1,
    default_timeout_ms INT NOT NULL DEFAULT 10000,
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_web_ui_environment_workspace ON tb_web_ui_environment(workspace_id);
```

- [ ] **Step 2: Add MySQL migration**

Use the same SQL in `src/main/resources/db/migration-mysql/V47__add_web_ui_automation_asset_tables.sql`. The existing project uses compatible `AUTO_INCREMENT`, `TINYINT(1)`, and `TIMESTAMP` syntax in both migration folders.

- [ ] **Step 3: Verify Flyway ordering**

Run:

```powershell
cd D:\Project\auto\server
mvn -DskipTests compile
```

Expected: compile succeeds and no duplicate Flyway version error appears.

---

### Task 2: Backend Entities And Mappers

**Files:**

- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiCaseEntity.java`
- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiCaseStepEntity.java`
- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiEnvironmentEntity.java`
- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiCaseMapper.java`
- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiCaseStepMapper.java`
- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiEnvironmentMapper.java`

- [ ] **Step 1: Add `WebUiCaseEntity`**

```java
package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_web_ui_case")
public class WebUiCaseEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("module_name")
    private String moduleName;

    @TableField("case_name")
    private String caseName;

    private String description;

    @TableField("base_url")
    private String baseUrl;

    @TableField("browser_type")
    private String browserType;

    private Boolean headless;

    @TableField("default_timeout_ms")
    private Integer defaultTimeoutMs;

    private String status;

    @TableField("last_run_result")
    private String lastRunResult;

    @TableField("last_run_at")
    private LocalDateTime lastRunAt;
}
```

- [ ] **Step 2: Add `WebUiCaseStepEntity`**

```java
package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_web_ui_case_step")
public class WebUiCaseStepEntity extends BaseEntity {

    @TableField("case_id")
    private Long caseId;

    @TableField("step_name")
    private String stepName;

    @TableField("step_type")
    private String stepType;

    @TableField("locator_type")
    private String locatorType;

    @TableField("locator_value")
    private String locatorValue;

    @TableField("input_value")
    private String inputValue;

    @TableField("timeout_ms")
    private Integer timeoutMs;

    @TableField("continue_on_failure")
    private Boolean continueOnFailure;

    @TableField("screenshot_policy")
    private String screenshotPolicy;

    private Boolean enabled;

    @TableField("sort_order")
    private Integer sortOrder;
}
```

- [ ] **Step 3: Add `WebUiEnvironmentEntity`**

```java
package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_web_ui_environment")
public class WebUiEnvironmentEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("environment_name")
    private String environmentName;

    @TableField("base_url")
    private String baseUrl;

    @TableField("browser_type")
    private String browserType;

    private Boolean headless;

    @TableField("default_timeout_ms")
    private Integer defaultTimeoutMs;

    private Integer status;
}
```

- [ ] **Step 4: Add mappers**

Create three mapper files:

```java
package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WebUiCaseMapper extends BaseMapper<WebUiCaseEntity> {
}
```

```java
package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WebUiCaseStepMapper extends BaseMapper<WebUiCaseStepEntity> {
}
```

```java
package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WebUiEnvironmentMapper extends BaseMapper<WebUiEnvironmentEntity> {
}
```

- [ ] **Step 5: Verify compile**

Run:

```powershell
cd D:\Project\auto\server
mvn -DskipTests compile
```

Expected: compile succeeds.

---

### Task 3: Backend Models And Format Support

**Files:**

- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiAutomationModels.java`
- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiAutomationFormatSupport.java`

- [ ] **Step 1: Add request and response models**

Create `WebUiAutomationModels.java`:

```java
package com.company.autoplatform.webuiautomation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.List;

public final class WebUiAutomationModels {

    private WebUiAutomationModels() {
    }

    public record SaveWebUiCaseRequest(
            String workspaceCode,
            String moduleName,
            @NotBlank(message = "Case name cannot be blank") String name,
            String description,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            String status,
            @Valid List<SaveWebUiCaseStepRequest> steps
    ) {
    }

    public record SaveWebUiCaseStepRequest(
            Long id,
            @NotBlank(message = "Step name cannot be blank") String name,
            @NotBlank(message = "Step type cannot be blank") String type,
            String locatorType,
            String locatorValue,
            String inputValue,
            Integer timeoutMs,
            Boolean continueOnFailure,
            String screenshotPolicy,
            Boolean enabled,
            Integer sortOrder
    ) {
    }

    public record WebUiCaseItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String moduleName,
            String name,
            String description,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            String status,
            Integer stepCount,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime updatedAt
    ) {
    }

    public record WebUiCaseDetail(
            Long id,
            String workspaceCode,
            String workspaceName,
            String moduleName,
            String name,
            String description,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            String status,
            List<WebUiCaseStepItem> steps,
            String lastRunResult,
            LocalDateTime lastRunAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record WebUiCaseStepItem(
            Long id,
            String name,
            String type,
            String locatorType,
            String locatorValue,
            String inputValue,
            Integer timeoutMs,
            Boolean continueOnFailure,
            String screenshotPolicy,
            Boolean enabled,
            Integer sortOrder
    ) {
    }

    public record SaveWebUiEnvironmentRequest(
            String workspaceCode,
            @NotBlank(message = "Environment name cannot be blank") String name,
            @NotBlank(message = "Base URL cannot be blank") String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            Integer status
    ) {
    }

    public record WebUiEnvironmentItem(
            Long id,
            String workspaceCode,
            String workspaceName,
            String name,
            String baseUrl,
            String browserType,
            Boolean headless,
            Integer defaultTimeoutMs,
            Integer status,
            LocalDateTime updatedAt
    ) {
    }
}
```

- [ ] **Step 2: Add format helpers**

Create `WebUiAutomationFormatSupport.java`:

```java
package com.company.autoplatform.webuiautomation;

import java.util.List;
import java.util.Optional;

final class WebUiAutomationFormatSupport {

    static final String DEFAULT_BROWSER_TYPE = "CHROMIUM";
    static final String DEFAULT_CASE_STATUS = "ENABLED";
    static final String DEFAULT_SCREENSHOT_POLICY = "ON_FAILURE";
    static final int DEFAULT_CASE_TIMEOUT_MS = 10000;
    static final int DEFAULT_STEP_TIMEOUT_MS = 5000;
    static final int MIN_TIMEOUT_MS = 1000;
    static final int MAX_TIMEOUT_MS = 60000;

    private WebUiAutomationFormatSupport() {
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    static String requiredTrim(String value) {
        return value == null ? "" : value.trim();
    }

    static String normalizeUpper(String value, String fallback) {
        return Optional.ofNullable(blankToNull(value)).map(String::toUpperCase).orElse(fallback);
    }

    static int normalizeTimeout(Integer value, int fallback) {
        int resolved = value == null || value <= 0 ? fallback : value;
        return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, resolved));
    }

    static boolean normalizeBoolean(Boolean value, boolean fallback) {
        return value == null ? fallback : value;
    }

    static int normalizeStatus(Integer value) {
        return value == null ? 1 : value;
    }

    static <T> List<T> defaultList(List<T> items) {
        return items == null ? List.of() : items;
    }
}
```

- [ ] **Step 3: Verify compile**

Run:

```powershell
cd D:\Project\auto\server
mvn -DskipTests compile
```

Expected: compile succeeds.

---

### Task 4: Backend Domain Services And Controller

**Files:**

- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiCaseDomainService.java`
- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiEnvironmentDomainService.java`
- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiAutomationService.java`
- Create: `D:\Project\auto\server\src\main\java\com\company\autoplatform\webuiautomation\WebUiAutomationController.java`

- [ ] **Step 1: Implement case domain service**

Implement `WebUiCaseDomainService` with these public methods:

```java
public PageResponse<WebUiCaseItem> listCases(String workspaceCode, String keyword, String moduleName, String status, Integer pageNo, Integer pageSize)
public WebUiCaseDetail getCase(Long id, String workspaceCode)
public WebUiCaseDetail createCase(String headerWorkspaceCode, SaveWebUiCaseRequest request)
public WebUiCaseDetail updateCase(Long id, String headerWorkspaceCode, SaveWebUiCaseRequest request)
public void deleteCase(Long id, String workspaceCode)
```

Required behavior:

- Use `ApiWorkspaceScopeSupport.applyWorkspaceScope` for list filtering.
- Use `workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode())` for create/update target workspace.
- Reject moving a case to another workspace during update.
- Store steps by replacing the existing step set inside the update transaction:
  - delete existing `tb_web_ui_case_step` rows for the case
  - insert normalized request steps with sequential `sortOrder`
- List response includes `stepCount`.
- Detail response includes ordered steps.
- Delete removes steps first, then the case.

Validation rules inside service:

```text
name: nonblank after trim
browserType: CHROMIUM, FIREFOX, or WEBKIT; default CHROMIUM
status: ENABLED or DISABLED; default ENABLED
step type: OPEN, CLICK, FILL, CLEAR, WAIT_FOR, ASSERT_VISIBLE, ASSERT_TEXT, SCREENSHOT
locator required for CLICK, FILL, CLEAR, WAIT_FOR, ASSERT_VISIBLE, ASSERT_TEXT
input required for OPEN, FILL, ASSERT_TEXT
timeout: clamp to 1000..60000
screenshotPolicy: NONE, ON_FAILURE, ALWAYS; default ON_FAILURE
```

- [ ] **Step 2: Implement environment domain service**

Implement `WebUiEnvironmentDomainService` with these public methods:

```java
public PageResponse<WebUiEnvironmentItem> listEnvironments(String workspaceCode)
public WebUiEnvironmentItem createEnvironment(String headerWorkspaceCode, SaveWebUiEnvironmentRequest request)
public WebUiEnvironmentItem updateEnvironment(Long id, String headerWorkspaceCode, SaveWebUiEnvironmentRequest request)
public void deleteEnvironment(Long id, String workspaceCode)
```

Required behavior:

- Use workspace scope and writable workspace rules matching `ApiConfigDomainService`.
- Normalize browser type and timeout with `WebUiAutomationFormatSupport`.
- Require nonblank `baseUrl`.
- Return workspace code/name from `WorkspaceService.requireWorkspaceById`.

- [ ] **Step 3: Add facade service**

Create `WebUiAutomationService` as a thin facade:

```java
package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.common.PageResponse;
import org.springframework.stereotype.Service;

import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.*;

@Service
public class WebUiAutomationService {

    private final WebUiCaseDomainService caseDomainService;
    private final WebUiEnvironmentDomainService environmentDomainService;

    public WebUiAutomationService(
            WebUiCaseDomainService caseDomainService,
            WebUiEnvironmentDomainService environmentDomainService
    ) {
        this.caseDomainService = caseDomainService;
        this.environmentDomainService = environmentDomainService;
    }

    public PageResponse<WebUiCaseItem> listCases(String workspaceCode, String keyword, String moduleName, String status, Integer pageNo, Integer pageSize) {
        return caseDomainService.listCases(workspaceCode, keyword, moduleName, status, pageNo, pageSize);
    }

    public WebUiCaseDetail getCase(Long id, String workspaceCode) {
        return caseDomainService.getCase(id, workspaceCode);
    }

    public WebUiCaseDetail createCase(String workspaceCode, SaveWebUiCaseRequest request) {
        return caseDomainService.createCase(workspaceCode, request);
    }

    public WebUiCaseDetail updateCase(Long id, String workspaceCode, SaveWebUiCaseRequest request) {
        return caseDomainService.updateCase(id, workspaceCode, request);
    }

    public void deleteCase(Long id, String workspaceCode) {
        caseDomainService.deleteCase(id, workspaceCode);
    }

    public PageResponse<WebUiEnvironmentItem> listEnvironments(String workspaceCode) {
        return environmentDomainService.listEnvironments(workspaceCode);
    }

    public WebUiEnvironmentItem createEnvironment(String workspaceCode, SaveWebUiEnvironmentRequest request) {
        return environmentDomainService.createEnvironment(workspaceCode, request);
    }

    public WebUiEnvironmentItem updateEnvironment(Long id, String workspaceCode, SaveWebUiEnvironmentRequest request) {
        return environmentDomainService.updateEnvironment(id, workspaceCode, request);
    }

    public void deleteEnvironment(Long id, String workspaceCode) {
        environmentDomainService.deleteEnvironment(id, workspaceCode);
    }
}
```

- [ ] **Step 4: Add controller**

Create endpoints under `/api/automation/web`:

```java
package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.*;

@RestController
@RequestMapping("/api/automation/web")
public class WebUiAutomationController {

    private final WebUiAutomationService webUiAutomationService;

    public WebUiAutomationController(WebUiAutomationService webUiAutomationService) {
        this.webUiAutomationService = webUiAutomationService;
    }

    @GetMapping("/cases")
    public ApiResponse<PageResponse<WebUiCaseItem>> listCases(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String moduleName,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer pageNo,
            @RequestParam(required = false) Integer pageSize
    ) {
        return ApiResponse.ok(webUiAutomationService.listCases(workspaceCode, keyword, moduleName, status, pageNo, pageSize));
    }

    @GetMapping("/cases/{id}")
    public ApiResponse<WebUiCaseDetail> getCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(webUiAutomationService.getCase(id, workspaceCode));
    }

    @PostMapping("/cases")
    public ApiResponse<WebUiCaseDetail> createCase(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveWebUiCaseRequest request
    ) {
        return ApiResponse.ok(webUiAutomationService.createCase(workspaceCode, request), "Web UI case created");
    }

    @PutMapping("/cases/{id}")
    public ApiResponse<WebUiCaseDetail> updateCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveWebUiCaseRequest request
    ) {
        return ApiResponse.ok(webUiAutomationService.updateCase(id, workspaceCode, request), "Web UI case updated");
    }

    @DeleteMapping("/cases/{id}")
    public ApiResponse<Void> deleteCase(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        webUiAutomationService.deleteCase(id, workspaceCode);
        return ApiResponse.ok(null, "Web UI case deleted");
    }

    @GetMapping("/environments")
    public ApiResponse<PageResponse<WebUiEnvironmentItem>> listEnvironments(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(webUiAutomationService.listEnvironments(workspaceCode));
    }

    @PostMapping("/environments")
    public ApiResponse<WebUiEnvironmentItem> createEnvironment(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveWebUiEnvironmentRequest request
    ) {
        return ApiResponse.ok(webUiAutomationService.createEnvironment(workspaceCode, request), "Web UI environment created");
    }

    @PutMapping("/environments/{id}")
    public ApiResponse<WebUiEnvironmentItem> updateEnvironment(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody SaveWebUiEnvironmentRequest request
    ) {
        return ApiResponse.ok(webUiAutomationService.updateEnvironment(id, workspaceCode, request), "Web UI environment updated");
    }

    @DeleteMapping("/environments/{id}")
    public ApiResponse<Void> deleteEnvironment(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        webUiAutomationService.deleteEnvironment(id, workspaceCode);
        return ApiResponse.ok(null, "Web UI environment deleted");
    }
}
```

- [ ] **Step 5: Verify compile**

Run:

```powershell
cd D:\Project\auto\server
mvn -DskipTests compile
```

Expected: compile succeeds.

---

### Task 5: Backend Integration Tests

**Files:**

- Create: `D:\Project\auto\server\src\test\java\com\company\autoplatform\webuiautomation\WebUiAutomationControllerIntegrationTests.java`

- [ ] **Step 1: Add controller integration tests**

Create tests that extend `IntegrationTestSupport` and use `MockMvc`.

Required tests:

```java
@Test
void createUpdateListAndDeleteWebUiCaseWithSteps() throws Exception
```

Test flow:

1. `POST /api/automation/web/cases` with `X-Workspace-Code` and two steps.
2. Assert response contains normalized `browserType=CHROMIUM`, `headless=true`, `steps.length()=2`.
3. `GET /api/automation/web/cases?keyword=<unique>` and assert the case appears with `stepCount=2`.
4. `PUT /api/automation/web/cases/{id}` with one replacement step.
5. `GET /api/automation/web/cases/{id}` and assert `steps.length()=1`.
6. `DELETE /api/automation/web/cases/{id}`.
7. `GET /api/automation/web/cases?keyword=<unique>` and assert total is `0`.

```java
@Test
void createUpdateListAndDeleteWebUiEnvironment() throws Exception
```

Test flow:

1. `POST /api/automation/web/environments`.
2. Assert normalized browser and timeout.
3. `GET /api/automation/web/environments`.
4. `PUT /api/automation/web/environments/{id}`.
5. `DELETE /api/automation/web/environments/{id}`.

```java
@Test
void rejectsStepMissingRequiredLocator() throws Exception
```

Test flow:

1. `POST /api/automation/web/cases` with a `CLICK` step that has no locator.
2. Assert HTTP 400.

- [ ] **Step 2: Run focused tests**

Run:

```powershell
cd D:\Project\auto\server
mvn -Dtest=WebUiAutomationControllerIntegrationTests test
```

Expected: all tests pass.

- [ ] **Step 3: Run backend compile**

Run:

```powershell
cd D:\Project\auto\server
mvn -DskipTests compile
```

Expected: compile succeeds.

---

### Task 6: Frontend Entity Package

**Files:**

- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\entities\web-ui-automation\model\types.ts`
- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\entities\web-ui-automation\model\options.ts`
- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\entities\web-ui-automation\lib\format.ts`
- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\entities\web-ui-automation\api\webUiAutomationApi.ts`
- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\entities\web-ui-automation\index.ts`
- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\entities\web-ui-automation\ui\WebUiCaseStatusBadge.vue`
- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\entities\web-ui-automation\ui\WebUiStepTypeBadge.vue`

- [ ] **Step 1: Add frontend types**

`model/types.ts` must define:

```ts
export type WebUiBrowserType = 'CHROMIUM' | 'FIREFOX' | 'WEBKIT'
export type WebUiCaseStatus = 'ENABLED' | 'DISABLED'
export type WebUiStepType = 'OPEN' | 'CLICK' | 'FILL' | 'CLEAR' | 'WAIT_FOR' | 'ASSERT_VISIBLE' | 'ASSERT_TEXT' | 'SCREENSHOT'
export type WebUiLocatorType = 'CSS' | 'TEXT' | 'ROLE' | 'PLACEHOLDER' | 'LABEL' | 'TEST_ID' | 'XPATH'
export type WebUiScreenshotPolicy = 'NONE' | 'ON_FAILURE' | 'ALWAYS'

export interface WebUiCaseStepItem {
  id: number | null
  name: string
  type: WebUiStepType | string
  locatorType: WebUiLocatorType | string | null
  locatorValue: string | null
  inputValue: string | null
  timeoutMs: number
  continueOnFailure: boolean
  screenshotPolicy: WebUiScreenshotPolicy | string
  enabled: boolean
  sortOrder: number
}

export interface WebUiCaseItem {
  id: number
  workspaceCode: string
  workspaceName: string
  moduleName: string | null
  name: string
  description: string | null
  baseUrl: string | null
  browserType: WebUiBrowserType | string
  headless: boolean
  defaultTimeoutMs: number
  status: WebUiCaseStatus | string
  stepCount: number
  lastRunResult: string | null
  lastRunAt: string | null
  updatedAt: string | null
}

export interface WebUiCaseDetail extends WebUiCaseItem {
  steps: WebUiCaseStepItem[]
  createdAt: string | null
}

export interface SaveWebUiCasePayload {
  workspaceCode?: string
  moduleName?: string | null
  name: string
  description?: string | null
  baseUrl?: string | null
  browserType?: string
  headless?: boolean
  defaultTimeoutMs?: number
  status?: string
  steps: WebUiCaseStepItem[]
}

export interface WebUiCaseListQuery {
  keyword?: string
  moduleName?: string
  status?: string
  pageNo?: number
  pageSize?: number
}

export interface WebUiEnvironmentItem {
  id: number
  workspaceCode: string
  workspaceName: string
  name: string
  baseUrl: string
  browserType: WebUiBrowserType | string
  headless: boolean
  defaultTimeoutMs: number
  status: number
  updatedAt: string | null
}

export interface SaveWebUiEnvironmentPayload {
  workspaceCode?: string
  name: string
  baseUrl: string
  browserType?: string
  headless?: boolean
  defaultTimeoutMs?: number
  status?: number
}

export interface PageResponse<T> {
  items: T[]
  total: number
  pageNo?: number
  pageSize?: number
  totalPages?: number
}
```

- [ ] **Step 2: Add options**

`model/options.ts` must export browser, step, locator, screenshot, and status options with Chinese labels.

- [ ] **Step 3: Add API wrapper**

`api/webUiAutomationApi.ts` must follow the existing `apiAutomationApi` style:

```ts
import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'
import type {
  PageResponse,
  SaveWebUiCasePayload,
  SaveWebUiEnvironmentPayload,
  WebUiCaseDetail,
  WebUiCaseItem,
  WebUiCaseListQuery,
  WebUiEnvironmentItem,
  WebUiCaseStepItem,
} from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return { 'X-Workspace-Code': workspaceCode }
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || 'Web UI 自动化请求失败')
  }
  return payload.data
}

function cleanQuery(query?: object) {
  if (!query) return undefined
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''))
}

function normalizePageResponse<T>(page: PageResponse<T>, normalizeItem: (item: T) => T): PageResponse<T> {
  const items = Array.isArray(page.items) ? page.items.map(normalizeItem) : []
  const total = Number(page.total ?? items.length)
  const pageSize = Number(page.pageSize || total || items.length || 10)
  return {
    items,
    total,
    pageNo: Number(page.pageNo || 1),
    pageSize,
    totalPages: Number(page.totalPages || (total > 0 ? Math.ceil(total / Math.max(pageSize, 1)) : 0)),
  }
}

function normalizeStep(step: WebUiCaseStepItem): WebUiCaseStepItem {
  return {
    ...step,
    id: step.id ?? null,
    name: step.name || '-',
    locatorType: step.locatorType || null,
    locatorValue: step.locatorValue || null,
    inputValue: step.inputValue || null,
    timeoutMs: Number(step.timeoutMs || 5000),
    continueOnFailure: Boolean(step.continueOnFailure),
    screenshotPolicy: step.screenshotPolicy || 'ON_FAILURE',
    enabled: step.enabled !== false,
    sortOrder: Number(step.sortOrder || 10),
  }
}

function normalizeCase(item: WebUiCaseItem): WebUiCaseItem {
  return {
    ...item,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    moduleName: item.moduleName || null,
    name: item.name || '-',
    description: item.description || null,
    baseUrl: item.baseUrl || null,
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    defaultTimeoutMs: Number(item.defaultTimeoutMs || 10000),
    status: item.status || 'ENABLED',
    stepCount: Number(item.stepCount || 0),
    lastRunResult: item.lastRunResult || null,
    lastRunAt: item.lastRunAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeCaseDetail(item: WebUiCaseDetail): WebUiCaseDetail {
  return {
    ...normalizeCase(item),
    steps: Array.isArray(item.steps) ? item.steps.map(normalizeStep) : [],
    createdAt: item.createdAt || null,
  }
}

function normalizeEnvironment(item: WebUiEnvironmentItem): WebUiEnvironmentItem {
  return {
    ...item,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    name: item.name || '-',
    baseUrl: item.baseUrl || '',
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    defaultTimeoutMs: Number(item.defaultTimeoutMs || 10000),
    status: Number(item.status ?? 1),
    updatedAt: item.updatedAt || null,
  }
}

export const webUiAutomationApi = {
  async getCases(workspaceCode = 'ALL', query?: WebUiCaseListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiCaseItem>>>('/automation/web/cases', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeCase)
  },

  async getCaseDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<WebUiCaseDetail>>(`/automation/web/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async createCase(workspaceCode = 'ALL', data: SaveWebUiCasePayload) {
    const payload = await httpPost<ApiResponse<WebUiCaseDetail>, SaveWebUiCasePayload>('/automation/web/cases', data, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async updateCase(workspaceCode = 'ALL', id: number, data: SaveWebUiCasePayload) {
    const payload = await httpPut<ApiResponse<WebUiCaseDetail>, SaveWebUiCasePayload>(`/automation/web/cases/${id}`, data, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async deleteCase(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async getEnvironments(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiEnvironmentItem>>>('/automation/web/environments', {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeEnvironment)
  },

  async createEnvironment(workspaceCode = 'ALL', data: SaveWebUiEnvironmentPayload) {
    const payload = await httpPost<ApiResponse<WebUiEnvironmentItem>, SaveWebUiEnvironmentPayload>('/automation/web/environments', data, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeEnvironment(unwrapApiResponse(payload))
  },

  async updateEnvironment(workspaceCode = 'ALL', id: number, data: SaveWebUiEnvironmentPayload) {
    const payload = await httpPut<ApiResponse<WebUiEnvironmentItem>, SaveWebUiEnvironmentPayload>(`/automation/web/environments/${id}`, data, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeEnvironment(unwrapApiResponse(payload))
  },

  async deleteEnvironment(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/environments/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },
}
```

- [ ] **Step 4: Add index exports and badges**

`index.ts` exports API, types, options, and UI badges.

Badge components should wrap `AppStatusBadge` or `el-tag` and map:

```text
ENABLED -> success / 启用
DISABLED -> default / 停用
OPEN -> primary / 打开页面
CLICK -> primary / 点击
FILL -> success / 输入
CLEAR -> default / 清空
WAIT_FOR -> warning / 等待
ASSERT_VISIBLE -> success / 可见断言
ASSERT_TEXT -> success / 文本断言
SCREENSHOT -> default / 截图
```

- [ ] **Step 5: Run frontend typecheck**

Run:

```powershell
cd D:\perfectproject\newautoweb\perfectprojectwebchonggou-main
npm run typecheck
```

Expected: typecheck succeeds.

---

### Task 7: Frontend Web Automation Page

**Files:**

- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\pages\automation-web\WebAutomationPage.vue`
- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\widgets\web-ui-case-workspace\WebUiCaseWorkspace.vue`
- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\widgets\web-ui-case-workspace\WebUiCaseEditorDrawer.vue`
- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\widgets\web-ui-case-workspace\WebUiEnvironmentPanel.vue`
- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\widgets\web-ui-case-workspace\index.ts`
- Modify: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\app\router\index.ts`

- [ ] **Step 1: Add page shell**

`WebAutomationPage.vue` should mirror `ApiAutomationPage.vue`: resolve current workspace, pass `workspaceCode`, `workspaceReady`, and `workspaces` to `WebUiCaseWorkspace`.

- [ ] **Step 2: Route `/automation/web` to the new page**

Modify `src/app/router/index.ts`:

```ts
import WebAutomationPage from '@/pages/automation-web/WebAutomationPage.vue'
```

Change route:

```ts
{
  path: 'automation/web',
  name: 'automation-web',
  component: WebAutomationPage,
  meta: {
    title: 'Web UI 自动化',
    description: '手工编写 Web UI 自动化用例步骤，管理浏览器环境配置。',
  },
}
```

- [ ] **Step 3: Build workspace widget**

`WebUiCaseWorkspace.vue` responsibilities:

- Load cases and environments when `workspaceReady` and `workspaceCode` are ready.
- Render statistics cards:
  - 全部用例
  - 启用用例
  - 停用用例
  - 环境数
- Render filters:
  - keyword
  - status
  - moduleName
- Render tabs:
  - 用例列表
  - 环境配置
- Render table actions:
  - 编辑
  - 复制
  - 删除

No run/debug buttons in target package 1.

- [ ] **Step 4: Build case editor drawer**

`WebUiCaseEditorDrawer.vue` responsibilities:

- Create/edit form fields:
  - name
  - moduleName
  - description
  - baseUrl
  - browserType
  - headless
  - defaultTimeoutMs
  - status
- Editable step table fields:
  - enabled
  - name
  - type
  - locatorType
  - locatorValue
  - inputValue
  - timeoutMs
  - continueOnFailure
  - screenshotPolicy
- Step actions:
  - add
  - copy
  - move up
  - move down
  - delete
- Client validation:
  - name required
  - `OPEN`, `FILL`, `ASSERT_TEXT` input required
  - locator required for `CLICK`, `FILL`, `CLEAR`, `WAIT_FOR`, `ASSERT_VISIBLE`, `ASSERT_TEXT`
  - at least one enabled step before save is recommended but not required for target package 1

- [ ] **Step 5: Build environment panel**

`WebUiEnvironmentPanel.vue` responsibilities:

- List environments.
- Create/edit environment in dialog or drawer.
- Delete environment with confirmation.
- Fields:
  - name
  - baseUrl
  - browserType
  - headless
  - defaultTimeoutMs
  - status

- [ ] **Step 6: Run frontend typecheck and build**

Run:

```powershell
cd D:\perfectproject\newautoweb\perfectprojectwebchonggou-main
npm run typecheck
npm run build
```

Expected: both pass.

---

### Task 8: Frontend Delete Feature And UX Polish

**Files:**

- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\features\web-ui-case-delete\deleteWebUiCase.ts`
- Create: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\features\web-ui-case-delete\index.ts`
- Modify: `D:\perfectproject\newautoweb\perfectprojectwebchonggou-main\src\widgets\web-ui-case-workspace\WebUiCaseWorkspace.vue`

- [ ] **Step 1: Add delete helper**

`deleteWebUiCase.ts`:

```ts
import { ElMessage, ElMessageBox } from 'element-plus'
import { webUiAutomationApi, type WebUiCaseItem } from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'

export async function deleteWebUiCase(workspaceCode: string, item: WebUiCaseItem) {
  try {
    await ElMessageBox.confirm(`确认删除 Web UI 用例「${item.name}」？`, '删除用例', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    })
    await webUiAutomationApi.deleteCase(workspaceCode, item.id)
    ElMessage.success('Web UI 用例已删除')
    return true
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return false
    }
    ElMessage.error(getRequestErrorMessage(error))
    return false
  }
}
```

`index.ts`:

```ts
export { deleteWebUiCase } from './deleteWebUiCase'
```

- [ ] **Step 2: Wire delete helper into workspace widget**

After a successful delete, reload the current page. If the current page becomes empty and `pageNo > 1`, decrement to the previous page and reload.

- [ ] **Step 3: Confirm empty, loading, and error states**

Use shared UI where possible:

- `AppEmptyState` for empty case/environment tables.
- `v-loading` or existing loading state for table loading.
- Inline error message with retry button for load failures.

- [ ] **Step 4: Run frontend validation**

Run:

```powershell
cd D:\perfectproject\newautoweb\perfectprojectwebchonggou-main
npm run typecheck
npm run build
```

Expected: both pass.

---

### Task 9: End-To-End Local Smoke

**Files:**

- No new source files.

- [ ] **Step 1: Start backend**

Run:

```powershell
cd D:\Project\auto\server
mvn spring-boot:run
```

Expected: backend starts on the configured port and Flyway applies `V47`.

- [ ] **Step 2: Start frontend**

Run:

```powershell
cd D:\perfectproject\newautoweb\perfectprojectwebchonggou-main
npm run dev
```

Expected: Vite starts successfully.

- [ ] **Step 3: Browser smoke**

Manual smoke checklist:

- Login succeeds.
- Navigate to `/automation/web`.
- Case list requests `/api/automation/web/cases` with `X-Workspace-Code`.
- Environment list requests `/api/automation/web/environments` with `X-Workspace-Code`.
- Create a disposable environment named `DISPOSABLE-WEBUI-ENV-<timestamp>`.
- Create a disposable case named `DISPOSABLE-WEBUI-CASE-<timestamp>` with two steps:
  - `OPEN`, input `/login`
  - `ASSERT_VISIBLE`, locator type `TEXT`, locator value `登录`
- Edit the disposable case to add a `SCREENSHOT` step.
- Delete the disposable case.
- Delete the disposable environment.

- [ ] **Step 4: Final verification commands**

Run:

```powershell
cd D:\Project\auto\server
mvn -Dtest=WebUiAutomationControllerIntegrationTests test
```

Run:

```powershell
cd D:\perfectproject\newautoweb\perfectprojectwebchonggou-main
npm run typecheck
npm run build
```

Expected: backend test passes; frontend typecheck and build pass.

---

## Self-Review

Spec coverage:

- Manual step assets are covered by `tb_web_ui_case` and `tb_web_ui_case_step`.
- Browser environment configuration is covered by `tb_web_ui_environment`.
- Workspace isolation is covered through `X-Workspace-Code` and existing `WorkspaceService` patterns.
- `/automation/web` becomes a real page in Task 7.
- Playwright execution, run records, screenshots, and reports are intentionally outside target package 1.

Placeholder scan:

- No placeholder markers or unspecified implementation steps are used.
- Every task lists concrete files and commands.

Type consistency:

- Backend uses `WebUiCase*`, `WebUiEnvironment*`, and `/api/automation/web`.
- Frontend uses `WebUiCase*`, `WebUiEnvironment*`, and the same API paths.
- Table names use the existing project `tb_` prefix.
