# Local Runner 任务下发接口 DTO 设计

## 1. 文档目的

本文档定义平台后端与 Local Runner 之间的任务下发、领取、状态上报、日志回传、附件回传和取消控制的 DTO 契约。

它服务于后续这些能力：

- Web UI 元素采集。
- Web UI 元素真机验证。
- Web UI 用例本地执行。
- API 用例 / 场景本地执行。
- 指定 Runner 执行。
- Runner 池执行。

目标是先把接口契约定清楚，再进入代码实现，避免 Web UI 执行、API 执行、Runner 产品化各自定义一套任务结构。

## 2. 设计原则

1. `runId` 是全局幂等键。
2. `executionToken` 是任务有效性栅栏。
3. Runner 执行任务必须基于快照，不实时读取平台最新草稿。
4. 文件上传、测试数据必须通过 `artifactRefs` 引用平台工件，不依赖用户本机路径。
5. 服务端执行、本地执行、指定 Runner 执行的报告结构保持一致。
6. 敏感字段默认脱敏或加密传输，不进入本地明文日志。
7. DTO 先保证稳定语义，具体 Java / TypeScript 类型后续再映射。

## 3. 通信模式

### 3.1 本地执行

本地执行以 Runner 轮询为主。

```text
Runner -> 平台：领取任务
Runner -> 平台：上报心跳
Runner -> 平台：上报状态
Runner -> 平台：上传日志、附件、最终结果
```

### 3.2 指定 Runner / Runner 池

指定 Runner 和 Runner 池可以平台推送为主，Runner 轮询兜底。

```text
平台 -> Runner：推送任务，后续
Runner -> 平台：ACK / 状态 / 结果
Runner -> 平台：轮询兜底
```

## 4. 核心枚举

### 4.1 taskType

```text
WEB_ELEMENT_COLLECT
WEB_ELEMENT_VALIDATE
WEB_CASE_RUN
API_CASE_RUN
API_SCENARIO_RUN
```

### 4.2 executionLocation

```text
SERVER
LOCAL_RUNNER
ASSIGNED_RUNNER
RUNNER_POOL
```

### 4.3 taskStatus

```text
PENDING
ASSIGNED
RUNNING
PAUSED
SUCCESS
FAILED
CANCELED
DEGRADED
TIMEOUT
RUNNER_OFFLINE
```

### 4.4 priority

```text
DEBUG
MANUAL
CI
BATCH
```

建议优先级：

```text
DEBUG > MANUAL > CI > BATCH
```

### 4.5 screenshotUploadMode

```text
NONE
FAILURE_ONLY
EVERY_STEP
DEBUG_FULL
```

### 4.6 browserMode

```text
HEADED
HEADLESS
REUSE_EXISTING_PAGE
```

## 5. Runner 注册与健康检查 DTO

### 5.1 RunnerRegisterRequest

```json
{
  "installId": "local-install-uuid",
  "pairingCode": "123456",
  "runnerVersion": "0.1.0",
  "protocolVersion": "1.0",
  "machineHint": {
    "hostnameHash": "sha256...",
    "os": "Windows 11",
    "arch": "x64",
    "deviceName": "张三的办公电脑"
  },
  "capabilities": ["WEB_ELEMENT_COLLECT", "WEB_ELEMENT_VALIDATE"]
}
```

### 5.2 RunnerRegisterResponse

```json
{
  "runnerId": "runner_abc",
  "runnerToken": "secret-token",
  "runnerName": "张三的办公电脑",
  "protocolVersion": "1.0",
  "accepted": true,
  "message": null
}
```

### 5.3 RunnerHealthPayload

```json
{
  "runnerId": "runner_abc",
  "runnerVersion": "0.1.0",
  "protocolVersion": "1.0",
  "capabilities": [
    "WEB_ELEMENT_COLLECT",
    "WEB_ELEMENT_VALIDATE",
    "WEB_CASE_RUN",
    "API_CASE_RUN"
  ],
  "currentTaskId": null,
  "currentRunId": null,
  "queueSize": 0,
  "resource": {
    "totalSlots": 8,
    "usedSlots": 0,
    "browserProcessCount": 0,
    "apiRunningCount": 0
  },
  "browser": {
    "playwrightVersion": "1.x",
    "chromiumInstalled": true,
    "firefoxInstalled": false,
    "webkitInstalled": false
  },
  "session": {
    "pageAlive": false,
    "currentUrl": null,
    "boundRunId": null
  }
}
```

## 6. 任务领取 DTO

### 6.1 PullRunnerTaskRequest

```json
{
  "runnerId": "runner_abc",
  "runnerVersion": "0.1.0",
  "protocolVersion": "1.0",
  "capabilities": ["WEB_CASE_RUN", "API_CASE_RUN"],
  "workspaceCodes": ["account-open"],
  "resource": {
    "totalSlots": 8,
    "usedSlots": 2
  },
  "currentRunIds": ["run_001"]
}
```

### 6.2 PullRunnerTaskResponse

```json
{
  "hasTask": true,
  "serverTime": "2026-06-25T10:00:00Z",
  "pollIntervalMs": 2000,
  "task": {
    "runId": "run_002",
    "taskType": "WEB_CASE_RUN",
    "executionToken": "token-for-run-002",
    "priority": "MANUAL",
    "resourceCost": 5,
    "payload": {}
  }
}
```

如果没有任务：

```json
{
  "hasTask": false,
  "serverTime": "2026-06-25T10:00:00Z",
  "pollIntervalMs": 2000,
  "task": null
}
```

## 7. RunnerTaskEnvelope

所有任务下发统一包一层 envelope。

```json
{
  "runId": "run_002",
  "taskType": "WEB_CASE_RUN",
  "executionLocation": "LOCAL_RUNNER",
  "executionToken": "token-for-run-002",
  "runnerId": "runner_abc",
  "workspaceCode": "account-open",
  "userId": "user_001",
  "protocolVersion": "1.0",
  "priority": "MANUAL",
  "resourceCost": 5,
  "createdAt": "2026-06-25T10:00:00Z",
  "deadlineAt": "2026-06-25T10:30:00Z",
  "timeoutPolicy": {},
  "environmentSnapshot": {},
  "variableSnapshot": {},
  "scriptSnapshot": {},
  "artifactRefs": [],
  "maskingRules": [],
  "screenshotPolicy": {},
  "payload": {}
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| runId | 全局执行 ID，幂等键 |
| taskType | 任务类型 |
| executionToken | 任务有效性栅栏 |
| protocolVersion | 协议版本 |
| resourceCost | 资源槽成本 |
| deadlineAt | 整体任务截止时间 |
| environmentSnapshot | 环境快照 |
| variableSnapshot | 变量快照 |
| scriptSnapshot | 脚本快照 |
| artifactRefs | 工件引用 |
| maskingRules | 脱敏规则 |
| screenshotPolicy | 截图上传策略 |
| payload | 任务类型专属载荷 |

## 8. timeoutPolicy

```json
{
  "taskTimeoutMs": 1800000,
  "stepTimeoutMs": 30000,
  "requestTimeoutMs": 30000,
  "uploadTimeoutMs": 60000,
  "runnerHeartbeatTimeoutMs": 15000,
  "retryCount": 0,
  "continueOnFailure": false
}
```

说明：

- `taskTimeoutMs`：整体任务超时。
- `stepTimeoutMs`：Web UI 步骤默认超时。
- `requestTimeoutMs`：API 请求默认超时。
- `uploadTimeoutMs`：附件上传超时。
- `runnerHeartbeatTimeoutMs`：平台判断 Runner 离线阈值。
- `retryCount`：任务或步骤重试次数，具体由任务类型解释。
- `continueOnFailure`：默认失败是否继续。

## 9. environmentSnapshot

```json
{
  "environmentId": 12,
  "environmentName": "测试环境",
  "baseUrl": "https://test.example.com",
  "browserType": "CHROMIUM",
  "browserMode": "HEADED",
  "defaultTimeoutMs": 30000,
  "authStateRef": {
    "enabled": true,
    "workspaceCode": "account-open",
    "environmentId": 12,
    "savedAt": "2026-06-25T09:00:00Z",
    "sourceUrl": "https://test.example.com/login"
  },
  "proxy": {
    "inheritSystemProxy": true,
    "httpProxy": null,
    "httpsProxy": null,
    "noProxy": "localhost,127.0.0.1"
  },
  "envAllowlist": ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "CUSTOM_CERT_PATH"]
}
```

注意：

- Runner 默认不读取本机全量环境变量。
- 只允许 `envAllowlist` 中的变量进入网络层或明确允许的上下文。

## 10. variableSnapshot

```json
{
  "version": 3,
  "variables": [
    {
      "name": "USERNAME",
      "value": "test_user",
      "sensitive": false,
      "source": "VARIABLE_SET"
    },
    {
      "name": "PASSWORD",
      "value": "***",
      "encryptedValue": "cipher-text",
      "sensitive": true,
      "source": "ENVIRONMENT"
    }
  ],
  "resolutionOrder": [
    "BUILT_IN",
    "PROJECT_DEFAULT",
    "ENVIRONMENT",
    "VARIABLE_SET",
    "RUNTIME",
    "EXTRACTED"
  ]
}
```

敏感变量：

- DTO 中可以携带加密值。
- Runner 解密后仅内存使用。
- 本地日志和报告不出现明文。

## 11. scriptSnapshot

```json
{
  "version": 5,
  "sandbox": {
    "enabled": true,
    "engine": "UNDECIDED",
    "timeoutMs": 3000,
    "allowFileSystem": false,
    "allowSystemCommand": false,
    "allowProcessEnv": false
  },
  "commonScripts": [
    {
      "scriptId": "common_001",
      "name": "common.js",
      "content": "function timestamp(){ return Date.now(); }",
      "checksum": "sha256..."
    }
  ],
  "preScript": {
    "content": "",
    "checksum": null
  },
  "postScript": {
    "content": "",
    "checksum": null
  }
}
```

原则：

- Runner 执行任务快照中的脚本内容。
- 不实时读取平台最新脚本。
- 不读取用户本机脚本文件。

## 12. artifactRefs

```json
[
  {
    "fileId": "file_001",
    "fileName": "avatar.jpg",
    "fileType": "IMAGE",
    "size": 204800,
    "checksum": "sha256...",
    "downloadUrl": "/api/automation/artifacts/file_001/download",
    "usage": "WEB_UI_FILE_UPLOAD",
    "required": true
  }
]
```

Runner 处理：

```text
下载 artifact
-> 校验 checksum
-> 存入 runId 临时目录
-> 执行步骤引用本地临时路径
-> 任务结束清理
```

## 13. screenshotPolicy

```json
{
  "screenshotPolicy": "ON_FAILURE",
  "screenshotUploadMode": "FAILURE_ONLY",
  "format": "WEBP",
  "quality": 75,
  "maxWidth": 1920,
  "includeDomSnapshotOnSuccess": true,
  "keepDebugArtifactsMinutes": 30
}
```

建议：

- 调试模式可 `DEBUG_FULL`。
- CI / 无人执行默认 `FAILURE_ONLY`。
- 成功步骤可只上传 DOM 摘要。

## 14. maskingRules

```json
[
  {
    "ruleId": "mask_phone",
    "type": "REGEX",
    "pattern": "1[3-9]\\d{9}",
    "replacement": "1**********",
    "enabled": true
  },
  {
    "ruleId": "mask_auth",
    "type": "FIELD_NAME",
    "pattern": "authorization",
    "replacement": "***",
    "enabled": true
  }
]
```

Runner 必须在上传日志、请求响应、错误信息前执行脱敏。

## 15. WEB_ELEMENT_COLLECT payload

```json
{
  "moduleId": 1,
  "pageId": 2,
  "pageName": "订单列表",
  "groupStrategy": "AI",
  "scope": "ALL",
  "expectedUrl": "https://test.example.com/orders",
  "aiModelConfigId": 10,
  "collectOptions": {
    "includeIframe": true,
    "includeShadowDom": true,
    "includePortalHints": true,
    "maxRawCandidates": 5000
  }
}
```

## 16. WEB_ELEMENT_VALIDATE payload

```json
{
  "pageUrl": "https://test.example.com/orders",
  "locators": [
    {
      "candidateId": "candidate_001",
      "locatorType": "TEST_ID",
      "locatorValue": "submit-order",
      "framePath": [],
      "shadowPath": [],
      "portalRootHint": null
    }
  ],
  "validationOptions": {
    "autoScroll": true,
    "captureScreenshot": true,
    "screenshotLimit": 8
  }
}
```

## 17. WEB_CASE_RUN payload

```json
{
  "caseSnapshot": {
    "caseId": 1001,
    "caseVersion": 7,
    "caseName": "订单创建流程",
    "browserType": "CHROMIUM",
    "headless": false,
    "baseUrl": "https://test.example.com",
    "steps": [
      {
        "stepId": "step_001",
        "sortOrder": 1,
        "type": "OPEN",
        "name": "打开订单页",
        "url": "/orders",
        "timeoutMs": 30000,
        "continueOnFailure": false,
        "screenshotPolicy": "ON_FAILURE"
      },
      {
        "stepId": "step_002",
        "sortOrder": 2,
        "type": "CLICK",
        "name": "点击新建",
        "locatorType": "ROLE",
        "locatorValue": "button[name=\"新建\"]",
        "framePath": [],
        "shadowPath": [],
        "timeoutMs": 30000,
        "continueOnFailure": false,
        "screenshotPolicy": "ON_FAILURE"
      }
    ]
  },
  "runOptions": {
    "debugMode": true,
    "pauseOnFailure": true,
    "reuseExistingPage": false
  }
}
```

## 18. API_CASE_RUN payload

```json
{
  "apiCaseSnapshot": {
    "caseId": 2001,
    "caseVersion": 4,
    "caseName": "查询订单详情",
    "request": {
      "method": "GET",
      "url": "{{BASE_URL}}/api/orders/{{ORDER_ID}}",
      "headers": [
        {
          "name": "Authorization",
          "value": "Bearer {{TOKEN}}",
          "enabled": true
        }
      ],
      "queryParams": [],
      "body": null
    },
    "assertions": [
      {
        "assertionId": "assert_001",
        "type": "STATUS_CODE",
        "expected": "200",
        "soft": false
      }
    ],
    "extractors": [
      {
        "extractorId": "extract_001",
        "name": "ORDER_STATUS",
        "type": "JSON_PATH",
        "expression": "$.status"
      }
    ]
  }
}
```

## 19. API_SCENARIO_RUN payload

```json
{
  "scenarioSnapshot": {
    "scenarioId": 3001,
    "scenarioVersion": 2,
    "scenarioName": "订单完整链路",
    "steps": [
      {
        "stepId": "api_step_001",
        "type": "API_CASE",
        "caseSnapshot": {},
        "continueOnFailure": false
      }
    ]
  },
  "runOptions": {
    "stopOnFirstFailure": true
  }
}
```

## 20. 状态上报 DTO

### 20.1 RunnerTaskStatusReport

```json
{
  "runId": "run_002",
  "runnerId": "runner_abc",
  "executionToken": "token-for-run-002",
  "status": "RUNNING",
  "currentStage": "STEP_RUNNING",
  "progress": {
    "current": 5,
    "total": 10,
    "percent": 50
  },
  "message": "正在执行第 5 步",
  "reportedAt": "2026-06-25T10:05:00Z"
}
```

## 21. 日志上报 DTO

```json
{
  "runId": "run_002",
  "runnerId": "runner_abc",
  "executionToken": "token-for-run-002",
  "sequenceNo": 12,
  "level": "INFO",
  "message": "点击新建按钮",
  "stepId": "step_002",
  "timestamp": "2026-06-25T10:05:01Z",
  "data": {
    "locatorType": "ROLE",
    "locatorValue": "button[name=\"新建\"]"
  }
}
```

平台按 `runId + sequenceNo` 幂等去重。

## 22. 步骤结果 DTO

```json
{
  "runId": "run_002",
  "runnerId": "runner_abc",
  "executionToken": "token-for-run-002",
  "stepId": "step_002",
  "status": "PASSED",
  "startedAt": "2026-06-25T10:05:00Z",
  "finishedAt": "2026-06-25T10:05:02Z",
  "durationMs": 2000,
  "errorMessage": null,
  "screenshotRef": null,
  "extra": {
    "matchCount": 1,
    "currentUrl": "https://test.example.com/orders"
  }
}
```

## 23. 附件上传 DTO

### 23.1 CreateAttachmentRequest

```json
{
  "runId": "run_002",
  "runnerId": "runner_abc",
  "executionToken": "token-for-run-002",
  "attachmentType": "SCREENSHOT",
  "fileName": "step_002_failure.webp",
  "contentType": "image/webp",
  "size": 102400,
  "checksum": "sha256...",
  "stepId": "step_002"
}
```

### 23.2 CreateAttachmentResponse

```json
{
  "attachmentId": "att_001",
  "uploadUrl": "/api/automation/runner-runs/run_002/attachments/att_001/content",
  "expiresAt": "2026-06-25T10:15:00Z"
}
```

## 24. 最终结果 DTO

```json
{
  "runId": "run_002",
  "runnerId": "runner_abc",
  "executionToken": "token-for-run-002",
  "status": "SUCCESS",
  "startedAt": "2026-06-25T10:00:00Z",
  "finishedAt": "2026-06-25T10:10:00Z",
  "durationMs": 600000,
  "summary": {
    "total": 10,
    "passed": 10,
    "failed": 0,
    "skipped": 0,
    "warnings": 0
  },
  "errorMessage": null,
  "reportData": {}
}
```

## 25. 取消任务 DTO

Runner 轮询或上报时，平台可以返回取消指令。

```json
{
  "command": "CANCEL",
  "runId": "run_002",
  "reason": "用户取消任务",
  "executionTokenValid": false
}
```

Runner 收到后：

- 停止当前步骤。
- Web UI 关闭当前 browser context，调试保留现场除外。
- API 终止当前 HTTP 请求。
- 清理临时文件。
- 上报取消确认。

## 26. 错误码建议

```text
RUNNER_VERSION_INCOMPATIBLE
RUNNER_CAPABILITY_MISSING
TASK_ALREADY_ASSIGNED
TASK_TOKEN_EXPIRED
TASK_CANCELED
ARTIFACT_DOWNLOAD_FAILED
ARTIFACT_CHECKSUM_MISMATCH
AUTH_STATE_EXPIRED
RESOURCE_SLOT_NOT_ENOUGH
SCRIPT_SANDBOX_ERROR
ATTACHMENT_UPLOAD_FAILED
```

## 27. 后续落地顺序

建议后续代码落地顺序：

1. 后端定义 Runner 任务表和 runId。
2. 定义任务 envelope DTO。
3. 定义 Runner 心跳和任务轮询接口。
4. 定义状态、日志、步骤结果、最终结果回传接口。
5. 定义 artifact 下载和附件上传接口。
6. 先接 Web UI 元素验证任务。
7. 再接 Web UI 用例本地执行。
8. 最后接 API 用例 / 场景本地执行。

## 28. 最终结论

Local Runner 任务下发 DTO 的核心不是“字段越多越好”，而是保证：

- 任务可幂等。
- 执行可取消。
- 上报可去重。
- 报告可复现。
- 文件可追溯。
- 敏感数据可控。
- 服务端执行和 Runner 执行语义一致。

这份 DTO 草案确定后，后端、前端和 Runner 才能并行开发，不会各自定义一套执行协议。
