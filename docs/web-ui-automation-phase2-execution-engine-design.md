# Web UI 自动化二期设计方案：Playwright 执行引擎与报告闭环

## 1. 目标

二期目标是把一期已经完成的 Web UI 用例、步骤和环境配置接入真实执行能力，形成最小可用闭环：

```text
选择 Web UI 用例 -> Playwright 执行 -> 保存执行记录、步骤结果、失败截图 -> 前端查看报告
```

本阶段要交付真实可运行能力，但不扩大到执行平台的复杂形态。队列、分布式执行节点、实时日志流、AI 诊断、录制器、参数化矩阵、多执行引擎都不进入二期。

## 2. 范围

### 2.1 本期做什么

- 在 `/automation/web` 页面运行已保存的 Web UI 用例。
- 在用例编辑器中调试运行当前草稿用例。
- 接入 Playwright Java 执行引擎。
- 支持一期已有步骤类型：
  - `OPEN`
  - `CLICK`
  - `FILL`
  - `CLEAR`
  - `WAIT_FOR`
  - `ASSERT_VISIBLE`
  - `ASSERT_TEXT`
  - `SCREENSHOT`
- 支持一期已有定位器类型：
  - `CSS`
  - `TEXT`
  - `ROLE`
  - `PLACEHOLDER`
  - `LABEL`
  - `TEST_ID`
  - `XPATH`
- 保存执行摘要、步骤结果、失败原因、耗时和截图附件。
- 更新 `web_ui_case.last_run_result` 和 `web_ui_case.last_run_at`。
- 前端增加运行入口、执行记录列表和执行详情抽屉。
- 所有接口继续使用 `X-Workspace-Code` 做工作空间隔离。

### 2.2 本期不做什么

- 异步队列执行。
- SSE 实时日志。
- 定时任务。
- 分布式浏览器执行节点。
- 浏览器池管理。
- Playwright trace、video、HAR、DOM 快照归档。
- AI 生成 Web UI 步骤。
- AI 失败诊断。
- 录制器。
- 参数化矩阵运行。
- 自定义 JavaScript 步骤。
- Selenium / Cypress 多引擎适配。

这些能力等执行和报告模型稳定后再扩展。

## 3. 技术方案选择

二期推荐采用：

```text
Spring Boot 后端内嵌 Playwright Java，同步执行最小闭环
```

选择原因：

- 当前后端是 Spring Boot，Playwright Java 可以直接嵌入现有服务。
- 一期 Web UI 资产已经在 `com.company.autoplatform.webuiautomation` 包下。
- 现有接口自动化已经有同步运行、结果持久化、报告返回的模式，可以参考工程组织方式。
- 不需要额外维护 Node runner 进程，部署复杂度更低。
- 二期步骤类型简单，Playwright Java 足够覆盖。

注意：Web UI 自动化不要直接复用接口自动化执行器。接口自动化执行的是 HTTP 请求和断言，Web UI 自动化执行的是浏览器上下文、页面定位器、截图和页面状态。两者可以复用平台模式，但不共用执行模型。

## 4. 后端架构

后端继续放在：

```text
server/src/main/java/com/company/autoplatform/webuiautomation
```

建议新增类：

```text
WebUiExecutionDomainService
WebUiExecutionEngineSupport
WebUiPlaywrightRunner
WebUiLocatorSupport
WebUiRunResultPersistenceSupport
WebUiArtifactStorageService
WebUiRunEntity
WebUiRunMapper
WebUiRunStepEntity
WebUiRunStepMapper
WebUiRunArtifactEntity
WebUiRunArtifactMapper
```

需要扩展的一期已有类：

```text
WebUiAutomationController
WebUiAutomationService
WebUiAutomationModels
WebUiCaseDomainService
WebUiAutomationFormatSupport
```

职责划分：

- `WebUiAutomationController`：只负责 HTTP 路由和请求响应。
- `WebUiAutomationService`：作为门面，统一委派用例、环境和执行能力。
- `WebUiExecutionDomainService`：校验工作空间权限，加载保存用例或草稿用例，组装响应。
- `WebUiExecutionEngineSupport`：创建 run 记录，协调执行流程，汇总结果，更新用例最近执行状态。
- `WebUiPlaywrightRunner`：管理 Playwright、browser、context、page 生命周期，并执行单个步骤。
- `WebUiLocatorSupport`：把系统存储的定位器类型和值转换为 Playwright Locator。
- `WebUiRunResultPersistenceSupport`：保存 run、step、artifact 元数据。
- `WebUiArtifactStorageService`：保存和读取截图文件。

## 5. 数据库设计

在一期迁移之后新增迁移：

```text
V48__add_web_ui_execution_tables.sql
```

H2 和 MySQL 两套迁移都要补齐。

### 5.1 `web_ui_run`

保存一次 Web UI 用例执行摘要。

```text
id
workspace_id
case_id
case_name
environment_id
environment_name
status
browser_type
headless
base_url
total_steps
passed_steps
failed_steps
skipped_steps
duration_ms
failure_summary
operator_name
started_at
finished_at
created_at
updated_at
```

状态值：

```text
RUNNING
SUCCESS
FAILED
CANCELED
```

`CANCELED` 本期只预留状态，不做取消接口。

### 5.2 `web_ui_run_step`

保存每个步骤的执行结果。

```text
id
run_id
case_step_id
step_name
step_type
status
locator_type
locator_value
input_value_snapshot
duration_ms
error_message
screenshot_artifact_id
sort_order
started_at
finished_at
created_at
updated_at
```

状态值：

```text
PENDING
RUNNING
PASSED
FAILED
SKIPPED
```

本期建议：当某个步骤失败且 `continueOnFailure = false` 时，后续启用步骤保存为 `SKIPPED`。这样报告能展示完整计划步骤，用户更容易理解为什么后续步骤没有执行。

### 5.3 `web_ui_run_artifact`

保存截图附件元数据。

```text
id
workspace_id
run_id
step_id
artifact_type
file_name
content_type
file_size
storage_path
created_at
updated_at
```

本期附件类型：

```text
SCREENSHOT
```

建议配置：

```text
app.web-ui-artifact.storage-root=./data/web-ui-artifacts
```

截图存储路径：

```text
workspace-{workspaceId}/run-{runId}/{uuid}.png
```

## 6. 接口设计

统一前缀继续使用：

```text
/api/automation/web
```

所有接口继续携带：

```text
X-Workspace-Code
```

### 6.1 运行已保存用例

```text
POST /api/automation/web/cases/{id}/run
```

请求体：

```json
{
  "environmentId": 1,
  "headless": true
}
```

说明：

- `environmentId` 可选。为空时使用用例自身的 `baseUrl`、`browserType`、`headless`、`defaultTimeoutMs`。
- `headless` 可选。传入时只覆盖本次运行，不修改用例或环境。

响应：

```json
{
  "runId": 12,
  "caseId": 3,
  "caseName": "Login smoke test",
  "status": "FAILED",
  "durationMs": 2400,
  "failureSummary": "Step 2 failed: locator not found",
  "totalSteps": 4,
  "passedSteps": 1,
  "failedSteps": 1,
  "skippedSteps": 2,
  "stepResults": []
}
```

运行接口可以返回步骤结果用于即时反馈；前端打开报告详情时仍应通过详情接口重新加载完整数据。

### 6.2 调试运行草稿用例

```text
POST /api/automation/web/cases/debug-run
```

请求体基于一期保存用例结构扩展：

```json
{
  "workspaceCode": "DEFAULT",
  "caseId": 3,
  "caseName": "Login smoke test draft",
  "baseUrl": "https://example.test",
  "browserType": "CHROMIUM",
  "headless": true,
  "defaultTimeoutMs": 10000,
  "environmentId": 1,
  "steps": []
}
```

说明：

- `caseId` 可选。
- 如果 `caseId` 存在且属于当前工作空间，可以更新该用例最近执行结果。
- 如果 `caseId` 为空，执行记录仍保存，但 `case_id = null`。

### 6.3 查询执行记录

```text
GET /api/automation/web/runs?caseId=&keyword=&status=&pageNo=&pageSize=
```

列表字段：

```text
id
workspaceCode
workspaceName
caseId
caseName
environmentName
status
browserType
headless
durationMs
failureSummary
totalSteps
passedSteps
failedSteps
skippedSteps
operatorName
startedAt
finishedAt
createdAt
```

### 6.4 查询执行详情

```text
GET /api/automation/web/runs/{id}
```

响应包含：

```text
run summary
steps[]
```

步骤字段：

```text
id
caseStepId
stepName
stepType
status
locatorType
locatorValue
inputValueSnapshot
durationMs
errorMessage
screenshotArtifactId
screenshotUrl
sortOrder
startedAt
finishedAt
```

### 6.5 下载截图附件

```text
GET /api/automation/web/runs/{runId}/artifacts/{artifactId}/download
```

必须校验：

- run 存在。
- artifact 属于该 run。
- run 所属工作空间对当前 `X-Workspace-Code` 可读。

## 7. 执行语义

### 7.1 运行配置优先级

运行时配置按以下优先级解析：

```text
本次运行请求覆盖值
-> 选中的 web_ui_environment
-> web_ui_case 保存值
-> 系统默认值
```

默认值：

```text
browserType = CHROMIUM
headless = true
defaultTimeoutMs = 10000
screenshotPolicy = ON_FAILURE
```

### 7.2 URL 解析

`OPEN` 步骤的输入值可以是绝对 URL 或相对路径。

规则：

- `http://` 或 `https://` 开头的值直接打开。
- 相对路径必须能解析到 `baseUrl`。
- 相对路径和 `baseUrl` 拼接时使用 URI 规则，避免简单字符串拼接产生双斜杠或缺斜杠问题。
- 最终 URL 为空或非法时，该步骤失败，并返回清晰错误。

### 7.3 步骤执行规则

步骤行为：

```text
OPEN            page.navigate(url)
CLICK           locator.click()
FILL            locator.fill(inputValue)
CLEAR           locator.clear()
WAIT_FOR        locator.waitFor，默认等待可见或挂载
ASSERT_VISIBLE  断言元素可见
ASSERT_TEXT     断言元素文本包含 inputValue
SCREENSHOT      截图
```

`ASSERT_TEXT` 本期使用“包含”匹配。精确匹配和正则匹配后续作为显式断言操作符扩展。

### 7.4 定位器映射

定位器映射：

```text
CSS          page.locator(value)
TEXT         page.getByText(value)
ROLE         role:name 格式，例如 button:Login
PLACEHOLDER  page.getByPlaceholder(value)
LABEL        page.getByLabel(value)
TEST_ID      page.getByTestId(value)
XPATH        page.locator("xpath=" + value)
```

`ROLE` 必须使用 `role:name` 格式。格式错误时，不执行页面操作，直接把该步骤标记为失败并返回校验错误。

### 7.5 失败与继续执行规则

步骤失败时：

- 保存失败步骤。
- 当截图策略是 `ON_FAILURE` 或 `ALWAYS` 时保存截图。
- `failureSummary` 使用第一个失败步骤的信息。
- 如果 `continueOnFailure = true`，继续执行下一步。
- 如果 `continueOnFailure = false`，后续启用步骤标记为 `SKIPPED`，本次 run 结果为 `FAILED`。

所有执行步骤都通过时，本次 run 结果为 `SUCCESS`。

用例没有任何启用步骤时，执行前直接拒绝，不创建浏览器资源。

### 7.6 截图策略

支持：

```text
NONE
ON_FAILURE
ALWAYS
```

`SCREENSHOT` 步骤无论策略如何都应截图。只有浏览器或页面初始化失败，导致步骤无法执行时例外。

## 8. 前端设计

基于一期页面继续扩展：

```text
src/pages/automation-web/WebAutomationPage.vue
src/widgets/web-ui-case-workspace/WebUiCaseWorkspace.vue
```

新增执行和报告相关模块：

```text
src/features/web-ui-case-run/runWebUiCase.ts
src/entities/web-ui-automation/ui/WebUiRunStatusBadge.vue
src/widgets/web-ui-case-workspace/WebUiRunDetailDrawer.vue
```

扩展实体层：

```text
src/entities/web-ui-automation/api/webUiAutomationApi.ts
src/entities/web-ui-automation/model/types.ts
src/entities/web-ui-automation/model/options.ts
src/entities/web-ui-automation/lib/format.ts
```

### 8.1 用例列表

行操作调整为：

```text
运行
报告
编辑
复制
删除
```

`运行` 行为：

- 运行数据时必须是具体工作空间，不能在只读聚合视图里创建执行记录。
- 请求携带当前工作空间头。
- 只给当前行展示 loading。
- 运行完成后刷新用例列表和执行记录列表。
- 返回结果后打开执行详情。

### 8.2 执行记录 Tab

新增或完善：

```text
执行记录
```

表格列：

```text
用例名称
执行状态
环境
浏览器
运行模式
耗时
通过/失败/跳过
失败摘要
执行人
开始时间
操作
```

操作：

```text
详情
重新运行
```

`重新运行` 使用已保存的 `caseId`。如果某条记录来自草稿运行且 `caseId = null`，隐藏或禁用重新运行。

### 8.3 执行详情抽屉

详情抽屉展示：

- 执行摘要。
- 失败摘要。
- 步骤表格。
- 每步状态。
- 每步耗时。
- 定位器。
- 输入快照。
- 错误信息。
- 截图预览或下载入口。

本期不做实时日志流，执行完成后展示最终结果。

## 9. 测试策略

### 9.1 后端测试

新增后端测试覆盖：

- 用例没有启用步骤时拒绝执行。
- `OPEN` 步骤能在可行情况下打开一个轻量测试页面。
- 错误定位器会生成 `FAILED` run 和 `FAILED` step。
- `continueOnFailure = false` 时后续步骤为 `SKIPPED`。
- 截图附件下载拒绝跨工作空间访问。
- 执行详情按步骤顺序返回结果。

考虑到 Playwright 浏览器二进制在不同机器上不一定已安装，执行器建议抽接口：

```text
WebUiBrowserRunner
```

测试可以分两层：

- 单元测试覆盖 URL 解析、定位器格式、步骤映射。
- 集成测试使用 fake runner 覆盖 controller、权限、持久化和报告返回。

真实 Playwright 冒烟测试可以作为本地或部署前验证，不强行要求每个普通集成测试都启动浏览器。

### 9.2 前端验证

运行：

```text
npm.cmd run typecheck
npm.cmd run build
```

手工冒烟流程：

```text
1. 打开 /automation/web。
2. 创建或选择一个包含 OPEN + ASSERT_TEXT 的用例。
3. 点击运行。
4. 确认执行记录出现。
5. 打开执行详情。
6. 使用错误定位器再运行一次，确认失败步骤、错误原因和截图能看到。
```

## 10. 部署与运行注意事项

Playwright Java 需要安装浏览器二进制。部署文档需要补充：

```text
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install chromium"
```

服务端部署建议：

- 默认无头模式。
- 浏览器二进制缺失时返回清晰错误。
- 不假设服务器存在桌面会话。
- 截图只写入配置的 artifact 根目录。
- 截图下载接口必须做工作空间鉴权。

## 11. 风险与控制

| 风险 | 影响 | 控制 |
| --- | --- | --- |
| Playwright 浏览器二进制缺失 | 执行立即失败 | 给出明确部署命令和运行错误 |
| 截图包含敏感信息 | 数据泄露 | 附件下载做工作空间鉴权，后续再加脱敏策略 |
| 同步运行耗时过长 | 请求超时 | 二期只用于短用例和调试用例，后续再升级异步队列 |
| 定位器不稳定 | 用例容易失败 | 推荐 TEST_ID / ROLE，报告里清楚展示定位器和错误 |
| 服务器不支持有头模式 | 执行失败 | 默认 headless，前端对非 headless 给出提示 |
| Playwright 依赖增加部署体积 | 后端部署变慢 | 二期部署文档只要求 Chromium |

## 12. 验收标准

二期完成后至少满足：

- 前端可以运行已保存 Web UI 用例。
- 前端可以调试运行当前草稿用例。
- 成功执行时保存 `SUCCESS` run 和 `PASSED` steps。
- 失败执行时保存 `FAILED` run、失败步骤错误、后续跳过步骤，并在策略要求时保存截图。
- `/automation/web` 可以查看执行记录列表。
- 执行详情抽屉可以查看每一步结果、耗时、错误和截图入口。
- 截图下载接口校验工作空间权限。
- 用例列表能展示最近执行结果和最近执行时间。
- 后端目标测试通过。
- 后端编译通过。
- 前端 typecheck 和 build 通过。

