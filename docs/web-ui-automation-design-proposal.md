# Web UI 自动化模块设计方案

## 1. 背景与结论

当前新前端是对旧项目 `D:\Project\auto\web` 的重构，后端仍使用 `D:\Project\auto\server`。现有系统已经具备登录、工作空间、用例中心、缺陷管理、配置中心、接口自动化、AI 用例生成、任务与报告等基础能力。

外部参考设计中提出了元素库、关键字、UI 自动化用例、套件、定时任务、报告、AI 自愈、多引擎执行等完整能力。方向可以作为长期蓝图参考，但不适合一次性照搬。原因是现有后端已经存在 `/api/tasks` 与 `/api/reports`，并且新前端已有 `automation-task` 基础模块。如果重新建设一套 `ui_task`、`ui_report` 和 `/api/v1/webui/task`，会和现有执行中心重复，增加迁移成本和数据割裂风险。

本方案建议采用三阶段落地：

1. 一期接入 Web UI 自动化任务与报告闭环，优先复用现有后端 `execution` 能力。
2. 二期建设 Web UI 自动化用例资产，包括页面、元素、步骤、断言、套件。
3. 三期接入 Playwright 执行器和 UI 专属 AI 能力，包括录制优化、定位自愈、AI 诊断。

一期目标不是做完整录制器，而是让 `/automation/web` 从占位模块变成可用的 Web UI 自动化管理入口。

## 2. 设计原则

### 2.1 跟随现有空间架构

不引入“项目”维度。所有查询、创建、编辑、删除都跟随现有工作空间体系：

- 前端使用 `workspaceCode`。
- 请求头使用 `X-Workspace-Code`。
- 后端数据绑定 `workspace_id`。
- `ALL` 仅表示聚合视角，不是实际业务归属。
- 在 `ALL` 视角下创建数据时，必须明确目标工作空间。

后端 `WorkspaceScope.normalize(null)` 默认会落到 `account-open`，不是 `ALL`。因此前端所有 Web UI 自动化请求必须显式传递当前 `workspaceCode`。

### 2.2 复用现有能力

以下能力不在 Web UI 自动化模块重复建设：

- 登录、用户、空间、空间成员和读写权限。
- 缺陷创建、缺陷详情、缺陷流转和附件能力。
- 全局 AI 供应商、模型和密钥配置。
- 平台通用手工用例 AI 生成和用例评审。
- 现有任务、报告、报告附件能力。

Web UI 自动化模块只补齐“浏览器 UI 自动化专属资产与执行能力”。

### 2.3 分阶段控制复杂度

一期不做以下内容：

- Playwright/Cypress/Selenium 三引擎同时接入。
- 浏览器录制器。
- 元素定位器 AI 自愈。
- HAR、DOM、视频、trace 采集。
- AI 多模态失败诊断。
- 独立定时调度系统。

这些能力需要新增后端模型、执行服务、文件存储、日志流和安全策略，应在二期或三期单独设计。

## 3. 一期范围：任务与报告闭环

### 3.1 一期目标

将现有 `/automation/web` 接入真实数据，实现：

- 查看 Web UI 自动化任务。
- 按工作空间、关键词、状态筛选任务。
- 新建、编辑、删除 Web 任务。
- 查看任务详情和关联报告。
- 按后端状态规则进行任务流转。
- 查看 Web 任务相关执行报告。
- 新建、编辑、删除报告。
- 编辑报告日志和失败摘要。
- 上传、下载、删除报告附件。
- 从失败报告创建缺陷。

### 3.2 后端复用接口

一期优先复用现有 `ExecutionController`：

```text
GET    /api/tasks
GET    /api/tasks/{id}
POST   /api/tasks
PUT    /api/tasks/{id}
DELETE /api/tasks/{id}
POST   /api/tasks/{id}/transition

GET    /api/reports
GET    /api/reports/{id}
POST   /api/reports
PUT    /api/reports/{id}
DELETE /api/reports/{id}
PUT    /api/reports/{id}/content
POST   /api/reports/{id}/attachments
GET    /api/reports/{id}/attachments/{attachmentId}/download
DELETE /api/reports/{id}/attachments/{attachmentId}

POST   /api/reports/{id}/bugs
```

任务查询必须传 `engineType=WEB`。报告列表当前后端没有 `engineType` 参数，一期前端可以通过任务索引在本地过滤 Web 任务关联报告。后续数据量变大时，建议后端补充报告列表的服务端筛选和分页。

### 3.3 页面结构

一期使用现有导航入口：

```text
/automation/web
```

页面名称：`Web UI 自动化`

页面布局：

1. 顶部操作区：工作空间选择、刷新、新建任务。
2. 统计区：当前任务、待执行、执行中、成功、失败、已取消。
3. 筛选区：关键词、状态。
4. 主体区：使用 tabs 切换“任务列表”和“执行报告”。

任务列表字段：

- 任务名称
- 状态
- 摘要
- 所属空间
- 操作：详情、编辑、流转、删除

任务详情抽屉：

- 基本信息
- 当前状态
- 关联报告
- 状态流转
- 新建报告入口

报告列表字段：

- 报告名称
- 关联任务
- 结果
- 日志来源
- 失败摘要
- 所属空间
- 操作：详情、编辑、删除、创建缺陷

报告详情抽屉：

- 报告基础信息
- 失败摘要
- 日志正文
- 附件列表
- 上传、下载、删除附件
- 创建缺陷入口

### 3.4 状态流转规则

一期严格跟随后端现有规则：

```text
READY   -> RUNNING / CANCELED
RUNNING -> SUCCESS / FAILED / CANCELED
SUCCESS -> 不允许流转
FAILED  -> 不允许流转
CANCELED -> 不允许流转
```

前端只展示后端允许的目标状态，避免用户选择明显无效的流转。

### 3.5 权限规则

一期不新增按钮级 RBAC。沿用现有空间读写规则：

- 可读空间：可以查看任务、报告、附件。
- 可写空间：可以新建、编辑、删除、流转、上传附件、创建缺陷。
- `ALL` 视角：可以查看当前账号可见空间的数据；新增任务或报告时必须选择具体工作空间。

## 4. 一期前端设计

### 4.1 目录结构

建议沿用新前端分层，不使用旧前端 `views/webui` 模式。

```text
src/
  entities/
    automation-task/
      api/
      model/
      lib/
      ui/
    automation-report/
      api/
      model/
      lib/
      ui/
  features/
    automation-task-create-edit/
    automation-task-transition/
    automation-task-delete/
    automation-report-create-edit/
    automation-report-content-edit/
    automation-report-attachment/
    automation-report-create-defect/
  widgets/
    web-automation-task-panel/
    web-automation-report-panel/
    web-automation-task-detail-drawer/
    web-automation-report-detail-drawer/
    web-automation-workspace/
  pages/
    automation-web/
      WebAutomationPage.vue
```

### 4.2 现有代码复用

当前新前端已有：

- `entities/automation-task`
- `pages/automation-tasks/AutomationTasksPage.vue`
- `widgets/automation-task-filter-panel`
- `widgets/automation-task-list-panel`
- `widgets/automation-task-summary-panel`

一期应在这些基础上增量扩展，而不是重写。现有任务列表组件可以升级为支持详情、编辑、流转和删除。

### 4.3 API 封装

扩展 `automationTaskApi`：

```ts
getTasks(workspaceCode, query)
getTaskDetail(workspaceCode, id)
createTask(workspaceCode, payload)
updateTask(workspaceCode, id, payload)
deleteTask(workspaceCode, id)
transitionTask(workspaceCode, id, payload)
```

新增 `automationReportApi`：

```ts
getReports(workspaceCode)
getReportDetail(workspaceCode, id)
createReport(workspaceCode, payload)
updateReport(workspaceCode, id, payload)
deleteReport(workspaceCode, id)
updateReportContent(workspaceCode, id, payload)
uploadReportAttachments(workspaceCode, reportId, files)
downloadReportAttachment(workspaceCode, reportId, attachmentId)
deleteReportAttachment(workspaceCode, reportId, attachmentId)
createBugFromReport(workspaceCode, reportId, payload)
```

### 4.4 UI 风格

保持现有新前端风格：

- 使用 `AppPage`、`AppButton`、`AppTable`、`AppDrawer`、`AppDialog` 等 shared UI。
- 使用 Element Plus 表格、表单、弹窗和抽屉。
- 页面级 CSS 只做布局，不重复定义基础按钮、表格、状态标签样式。
- 不复制旧前端大文件。

## 5. 一期后端建议

一期理论上不需要新增后端接口。但建议补两个小增强，降低前端本地过滤压力：

### 5.1 报告列表增加筛选和分页

建议增强：

```text
GET /api/reports?taskId=&engineType=&result=&keyword=&pageNo=&pageSize=
```

其中 `engineType=WEB` 可通过关联任务过滤。

### 5.2 报告创建缺陷接口确认

现有旧后端已有 `POST /api/reports/{id}/bugs`。新前端接入前需要确认 payload 与现有 `defectApi` 类型是否一致，必要时只补前端封装，不新建后端能力。

## 6. 二期范围：Web UI 自动化资产

二期开始建设 Web UI 自动化独有模型，建议只支持 Playwright 一个引擎。

建议后端模型：

```text
web_ui_page
web_ui_element
web_ui_case
web_ui_case_step
web_ui_assertion
web_ui_suite
web_ui_suite_case
web_ui_run
web_ui_run_step
web_ui_run_artifact
web_ui_config
```

字段风格应跟随现有后端，而不是外部文档里的 `spaceId/createTime/deleted`：

```text
id
workspace_id
created_at
updated_at
created_by
updated_by
```

二期页面：

- 页面与元素库
- UI 自动化用例列表
- 步骤编排器
- 断言管理
- 套件管理
- Playwright 执行配置

二期仍不强制接 AI。先把可执行资产模型做稳。

## 7. 三期范围：执行器与 AI 能力

三期接入真正执行器和 UI 专属 AI。

优先顺序：

1. Playwright 执行器。
2. 执行截图、日志、trace 归档。
3. 失败步骤定位。
4. AI 断言建议。
5. AI 定位器优化。
6. AI 失败诊断。
7. AI 自愈。
8. 定时巡检与重跑。

不建议三期之前接 Cypress 和 Selenium。三引擎会显著增加抽象复杂度，只有在真实业务需要时再补。

## 8. 与外部参考设计的取舍

保留：

- 空间隔离思想。
- 不重复建设缺陷、AI 配置、权限体系。
- Web UI 自动化与手工用例 AI 的能力边界。
- 长期能力链路：元素、用例、套件、任务、报告、AI 诊断。

调整：

- 不使用 `spaceId`，改为现有 `workspaceCode` / `workspace_id`。
- 不新增 `/webui-auto` 一级路由，沿用 `/automation/web`。
- 不新建 `ui_task` / `ui_report`，一期复用现有 `tasks` / `reports`。
- 不采用旧式 `views/webui` 大页面结构，使用新前端分层。
- 不在一期引入按钮级 RBAC。
- 不在一期同时支持 Playwright / Cypress / Selenium。

暂缓：

- AI 录制优化。
- AI 定位自愈。
- AI 多模态诊断。
- CDP 录制。
- HAR、DOM、视频、trace。
- 分布式执行节点。

## 9. 风险与应对

### 9.1 范围过大风险

如果一期就做完整元素库、脚本编排、执行器和 AI，自然会牵动大量后端表、执行服务和文件存储。应对方式是按三期拆分，一期只做任务与报告闭环。

### 9.2 数据模型重复风险

如果新增 `ui_task` 和 `ui_report`，会和现有 `tasks` / `reports` 重复。应对方式是一期复用现有 execution 模型，二期只新增 Web UI 专属资产表。

### 9.3 报告筛选性能风险

当前 `/api/reports` 缺少 engineType 和分页筛选。一期可前端过滤，二期或一期后半段补后端筛选分页。

### 9.4 执行器安全风险

未来浏览器执行器会访问业务系统，可能涉及账号、cookie、截图、DOM、HAR 敏感数据。三期设计时必须补脱敏、权限、文件访问控制和执行隔离。

## 10. 推荐实施顺序

1. 路由接入：`/automation/web` 指向 WebAutomationPage。
2. 扩展任务 API：详情、创建、编辑、删除、流转。
3. 完成任务列表、详情抽屉、新建编辑弹窗。
4. 新增报告实体和 API 封装。
5. 完成报告列表、详情抽屉、日志编辑。
6. 接入报告附件上传、下载、删除。
7. 接入从报告创建缺陷。
8. 补充后端报告筛选分页。
9. 运行 typecheck、build 和登录态浏览器 smoke。
10. 再评审二期 Web UI 自动化资产模型。

## 11. 一期验收标准

一期完成后，至少满足：

- 登录后可以访问 `/automation/web`。
- 工作空间切换后，任务请求携带正确 `X-Workspace-Code`。
- 任务列表只展示 `engineType=WEB` 的任务。
- 可创建、编辑、查看、流转、删除 Web 任务。
- 删除有报告的任务时，能展示后端错误提示。
- 可查看任务关联报告。
- 可创建、编辑、查看、删除报告。
- 可编辑报告失败摘要和日志正文。
- 可上传、下载、删除报告附件。
- 可从失败报告创建缺陷。
- 未登录访问 `/automation/web` 会跳转登录页。
- `npm run typecheck` 和 `npm run build` 通过。

