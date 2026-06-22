# Web UI 元素智能采集 Local Runner 最终设计

## 1. 文档目的

本文档记录 Web UI 自动化中“元素智能采集”的最终设计口径，用于后续前端、后端、Local Runner、AI 处理和元素库入库开发。

本设计已吸收当前讨论中的关键补充点，包括：

- Local Runner 本地执行方案
- 后端规则 + AI 异步处理
- Runner 本地真机验证闭环
- 任务幂等、校验幂等、元素版本化
- TTL、心跳、降级、取消、超时重试
- iframe / shadowDOM、自动滚动、超大 DOM 限流
- 前端进度、过滤日志、候选排序、批量操作
- 一期目标包裁剪边界

核心目标是：既支持公司真实业务系统的登录、验证码、扫码、SSO、内网访问，又避免一次性做成过重架构，按目标包逐步落地。

## 2. 总体定位

Web UI 元素智能采集采用以下架构：

```text
前端采集入口
  -> Local Runner 本地 Playwright
  -> 后端采集任务
  -> 后端规则过滤 / 去重 / 评分
  -> 后端 AI 命名 / 分组 / 解释 / 补充候选
  -> Runner 本地真机验证
  -> 后端生成最终候选
  -> 前端人工确认
  -> 元素库入库与追溯
```

职责划分：

- 前端负责采集入口、任务进度、候选展示、人工审核、批量保存。
- Local Runner 负责打开真实页面、复用本地登录态、采集页面素材、执行真机验证。
- 后端负责任务状态、素材持久化、规则过滤、去重合并、稳定性评分、AI 调用、最终候选生成。
- AI 负责命名、分组、语义解释、噪声判断、补充规则漏掉的候选。
- 元素库负责保存最终元素、版本链路、引用追踪和后续验证。

## 3. 为什么主推 Local Runner

普通用户在浏览器里登录平台，不代表后端服务器能访问被测系统。

真实企业环境经常存在：

- 被测系统只允许内网或 VPN 访问。
- 登录需要验证码、扫码、短信、SSO、多因子认证。
- 页面需要本地证书、办公网络、客户端插件或企业安全策略。
- 服务端部署环境无法弹出可交互浏览器窗口。
- 服务端无法复用用户本机已经完成的登录态。

因此，普通用户使用 AI 采集时，主路径采用 Local Runner：

- 用户本机启动 Runner。
- Runner 使用本机 Playwright 打开真实页面。
- 用户可以手动登录、扫码、过验证码。
- Runner 采集当前页面素材并上传后端。
- 后端 AI 和规则处理后，再下发 locator 给同一个 Runner 做真机验证。

服务端 Playwright 可以作为后续 CI、管理员、无登录页面或统一测试环境的补充能力，但不作为普通用户 AI 采集主路径。

## 4. Local Runner 形态

一期开发中，Local Runner 可以先是本地 Node 服务：

```text
127.0.0.1:39118
```

后续产品化可以打包成：

```text
Web UI Runner.exe
```

Runner 内置或自动安装：

- Playwright
- Chromium，默认
- Firefox，预留
- WebKit，预留

Runner 的本地服务只监听 `127.0.0.1`，不监听公网地址。

基础接口：

```text
GET  /health
POST /collect/open
POST /collect/capture
POST /auth/save
POST /auth/clear
```

后续任务化接口：

```text
GET  /session/status
POST /task/upload
GET  /task/poll
POST /validation/result
WS   /runner
```

## 5. 安全设计

一期安全策略：

- Runner 仅监听 `127.0.0.1`。
- 校验 Origin，只允许平台页面地址调用。
- CORS 仅放行本地开发和正式平台域名。
- 接口预留 `X-Web-Ui-Runner-Token`。

产品化阶段增强：

- Runner 启动生成本地 token。
- 前端首次绑定 Runner。
- 后续接口必须携带 token。
- Runner 校验请求来源域名。
- 防止第三方网页恶意调用本地 Runner。

## 6. 前端采集页设计

AI 采集抽屉不再以“输入 URL 生成候选”为核心，而是改成“采集当前页”。

推荐字段：

- 采集方式：本地执行器，默认。
- 目标页地址：可选，仅用于打开页面。
- 当前页面：Runner 实际采集到的 URL / title。
- 所属模块。
- 页面对象。
- 分组策略：AI 建议分组 / 自选分组。
- 自选分组：当选择自选分组时显示。
- AI 采集模型：必填，从系统 AI 连接池选择。
- 采集范围：表单、按钮、表格、弹窗、全部。
- 浏览器内核：默认 Chromium，预留 Firefox / WebKit。

按钮设计：

- 检测本地执行器。
- 打开目标页。
- 采集当前页。
- 取消任务。
- 保存选中元素。

原按钮调整：

- 在线 Runner 模式下，“生成候选元素”改为“采集当前页”。
- 离线 HTML / 截图导入模式下，可以继续使用“生成候选元素”。

## 7. 完整采集流程

### 7.1 阶段 1：采集任务创建

流程：

1. 前端点击“采集当前页”。
2. Runner 复用当前 Tab，或根据可选 URL 打开目标页面。
3. Runner 等待页面稳定加载。
4. Runner 采集完整原始素材。
5. Runner 仅剔除完全不可见节点和纯空节点。
6. Runner 上传素材到后端。
7. 后端落原始快照并返回 `taskId`。

采集素材包括：

- 页面 URL。
- 页面 title。
- 页面可见文本。
- 原始 DOM 候选元素。
- locator 初步候选。
- iframe 标记。
- shadowDOM 标记。
- 登录态引用 ID。
- 全局页面截图。
- viewport 信息。
- scrollX / scrollY。
- deviceScaleFactor。

重要原则：

```text
不阻塞前端 != 立即释放浏览器
```

后续真机验证需要复用当前页面上下文，因此从目标包 3 开始需要 TTL 会话保留。

### 7.2 阶段 2：后端规则 + AI 异步处理

后端处理：

1. 异步消费采集任务。
2. 规则过滤无意义元素。
3. 相似元素去重、合并。
4. 计算 locator 稳定性评分。
5. 调用 AI 做命名、分组、解释、噪声判断。
6. AI 生成补充候选 locator。
7. 对 AI 补充 locator 做静态语法校验。
8. 对 AI 补充 locator 做数量限流。
9. 生成待真机验证 locator 列表。

AI 不直接决定元素可用，必须经过规则校验和真机验证。

### 7.3 阶段 3：Runner 本地真机验证

后端将待验证 locator 下发给本次采集绑定的原 Runner。

下发方式：

- 优先 WebSocket。
- 如果 WebSocket 被拦截，Runner 通过 HTTP 轮询拉取验证任务。

Runner 验证动作：

1. 复用本次采集的 browser context / page。
2. 根据 frameChain / shadowPath 进入正确上下文。
3. 自动将目标元素滚动到视口内。
4. 执行 locator 匹配。
5. 判断是否可见、可点击、可输入、可选择。
6. 截取元素局部截图。
7. 批量回传验证结果。

每条验证结果包含：

- candidateId。
- locatorType。
- locatorValue。
- matchCount。
- visible。
- clickable。
- inputable。
- selectable。
- validationStatus。
- errorMessage。
- localScreenshotPath。
- boundingBox。
- scrollX / scrollY。
- viewportWidth / viewportHeight。
- deviceScaleFactor。
- verifiedAt。
- verifyCount。

如果同一任务下同一个 locator 多次验证，以最新结果为准，同时记录校验次数和最后校验时间。

### 7.4 阶段 4：生成最终候选

后端融合以下信息：

- 原始 DOM。
- 规则过滤结果。
- 去重合并结果。
- 稳定性评分。
- AI 命名、分组、解释。
- AI 补充候选。
- Runner 真机验证结果。

最终输出候选元素列表。

前端展示：

- 有效候选。
- 未验证候选。
- 低稳定性候选。
- 验证失败候选。
- 过滤日志。
- 全局截图。
- 元素局部截图。
- AI 说明。
- 推荐保存标记。

### 7.5 阶段 5：元素入库追溯

用户确认保存后，元素入库。

元素保存字段：

- 所属空间。
- 所属模块。
- 页面对象。
- 分组。
- 元素名称。
- 定位方式。
- 定位值。
- 备用定位器。
- 来源：智能采集。
- sourceTaskId。
- sourceCandidateId。
- 稳定性评分。
- 最近验证状态。
- 最近验证时间。
- 验证摘要。
- AI 描述。
- 截图地址。
- 版本号。

后续可以根据 `taskId` 复盘：

- 原始页面是什么。
- AI 为什么这么命名。
- 哪些元素被过滤。
- 哪些 locator 真机验证失败。
- 最终哪些元素被保存。

## 8. 任务状态设计

采集任务状态：

```text
CREATED
UPLOADING_SNAPSHOT
PROCESSING
WAITING_RUNNER_VALIDATION
VALIDATING
COMPLETED
FAILED
DEGRADED
CANCELED
```

候选验证状态：

```text
PASSED
FAILED
MULTIPLE
UNVERIFIED
DEGRADED
```

前端分阶段文案：

```text
上传快照
规则清洗
AI 分析
真机验证
处理完成
已降级
采集失败
已取消
```

## 9. 幂等与数据一致性

### 9.1 采集任务幂等

为避免重复点击、网络重发、页面刷新导致重复创建采集任务，需要增加短时间幂等控制。

建议幂等键：

```text
runnerId + sessionId + actualUrl/pageUrl + 10秒时间窗口
```

规则：

- 10 秒内相同幂等键重复请求，直接返回已有 `taskId`。
- 不重复创建任务。
- 不重复上传快照。
- 不重复消耗 AI 和后端规则处理资源。

### 9.2 校验结果幂等

同一个任务中，同一个 locator 可能因为网络重试或人工恢复被多次校验。

建议唯一键：

```text
taskId + candidateId
```

如果没有 candidateId，则使用：

```text
taskId + locatorType + locatorValue
```

规则：

- 最新校验结果覆盖旧结果。
- 保留 `verifyCount`。
- 保留 `lastVerifiedAt`。
- 避免候选状态来回跳变。

### 9.3 元素入库版本化

元素库不建议直接按“环境 + 页面 + locator 值”唯一，因为元素定义不应强依赖某个环境。

建议唯一判断：

```text
workspaceId + pageObjectId + locatorType + locatorValue
```

规则：

- 如果相同元素再次采集保存，不简单重复创建。
- 可以生成新版本。
- 新版本关联新的 `taskId`。
- 历史版本保留。
- 当前版本作为默认可用版本。
- 后续支持定位器迭代追溯和回滚。

环境信息属于验证和运行上下文，记录在验证结果或执行记录中，不作为元素定义唯一性的一部分。

## 10. TTL 与 Runner 心跳

Runner 会话 TTL 支持配置：

- 5 分钟。
- 10 分钟，默认。
- 15 分钟。

TTL 作用：

- 保留 browser context。
- 保留当前页面登录态。
- 等待后端 AI 处理完成后继续做真机验证。

Runner 每 5 到 10 秒上报心跳：

```text
runnerId
sessionId
taskId
browserAlive
pageAlive
currentUrl
pageTitle
lastActiveAt
hasPendingValidation
```

后端发现以下情况，可提前将任务置为 `DEGRADED`：

- 页面关闭。
- 浏览器关闭。
- 页面跳到登录页。
- 当前 URL 和采集快照明显不一致。
- Runner 心跳超时。
- TTL 过期。

## 11. 单会话单任务绑定

一个 browser context / session 同一时间只绑定一个采集任务。

原因：

- 避免用户连续点击两次采集。
- 避免两个任务复用同一页面。
- 避免后一次采集改变页面状态，导致前一个任务真机验证失真。

一期策略：

- 如果当前 session 有未完成任务，提示用户先结束旧任务。

后续增强：

- 自动新建独立 context。
- 支持多个任务并行，但每个任务绑定独立 session。

## 12. 降级策略

以下情况进入 `DEGRADED`：

- Runner 离线。
- WebSocket 不通且轮询失败。
- 页面关闭。
- 会话过期。
- 页面跳到登录页。
- 本地验证超时。
- 所有 locator 都验证失败。

降级后：

- 不阻断用户查看候选。
- 未真机验证候选标黄。
- 前端提示：

```text
未真机验证：Runner 离线或页面上下文异常，保存后可能存在定位失效风险。
```

如果所有 locator 都匹配不到，额外提示：

```text
页面上下文可能已变更，建议重新采集。
```

## 13. 取消任务全链路

用户点击取消后，必须全链路终止：

1. 前端停止轮询或订阅。
2. 后端任务状态改为 `CANCELED`。
3. 后端通过 WebSocket 或 Runner 轮询响应通知 Runner。
4. Runner 释放对应 browser context。
5. Runner 停止未完成验证。
6. 后端 worker 尽量终止规则 / AI / 验证处理。
7. 已上传素材按清理策略保留或删除。

取消不能只是关闭前端抽屉，否则会浪费本地和后端资源。

## 14. 超时与重试

### 14.1 校验任务超时

后端下发验证任务后，设置超时阈值：

```text
30 秒
```

规则：

- 30 秒未收到结果，重发 1 次。
- 重发后仍失败，任务进入 `DEGRADED`。
- 避免任务永久卡在 `VALIDATING`。

### 14.2 AI 处理超时

AI 处理建议超时：

```text
60 秒
```

规则：

- 超时后跳过 AI 补充候选。
- 保留规则过滤结果。
- 任务降级输出。
- 前端提示 AI 分析超时，但规则候选仍可使用。

## 15. iframe 与 shadowDOM

采集阶段需要记录：

- frameChain。
- frameUrl。
- shadowPath。
- 节点所在上下文。

验证阶段 Runner 需要支持：

- Playwright `frameLocator`。
- Shadow DOM 穿透定位。
- 与采集时节点标记一一对应。

否则跨 iframe / shadowDOM 页面会出现大量假阴性失败。

## 16. 元素校验前自动滚动

Runner 在判断元素是否可见、可点击、可输入前，应先执行：

```text
scrollIntoViewIfNeeded
```

原因：

- 真实用户操作前通常会滚动到目标元素。
- 视口外元素不应直接误判为不可见。
- 减少假阴性。

## 17. 超大 DOM 限流

单页面原始候选上限：

```text
5000 条
```

规则：

- 超出上限时截断。
- 记录过滤日志。
- 前端提示：

```text
页面元素过多，建议缩小采集范围。
```

后端 AI 处理超时：

```text
60 秒
```

超时后：

- 跳过 AI 补充。
- 仅走规则候选。
- 不阻塞整个任务。

## 18. 页面状态异常提前终止

Runner 采集时检测到以下情况，可以提前失败：

- 404 页面。
- 500 页面。
- 空白页。
- 浏览器错误页。

明显登录页需要区别处理：

- 如果用户目标不是登录页，提示需要登录态或重新打开页面。
- 如果用户确认本次就是采集登录页，则允许继续采集。

不要一刀切禁止登录页采集，因为登录页本身也可能需要账号、密码、登录按钮等元素。

## 19. 过滤日志与恢复

过滤日志需要结构化保存：

- 原始数量。
- 规则过滤数量。
- AI 过滤数量。
- 去重合并数量。
- 最终候选数量。
- 被过滤元素列表。
- 过滤原因。
- 是否建议恢复。

过滤原因：

```text
完全不可见
空节点
疑似布局容器
疑似图标装饰
Element Plus 内部包装节点
重复定位器
低稳定性定位器
AI 判断无业务意义
静态语法校验失败
真机验证未命中
```

恢复规则：

- 用户恢复被过滤元素后，自动加入待校验列表。
- 如果 Runner 会话仍在 TTL 内，自动触发真机验证。
- 如果会话已失效，标记为 `UNVERIFIED`。

## 20. 去重合并规则

一级去重：

```text
locatorType + locatorValue 完全一致
```

处理：

- 直接合并。

二级合并：

```text
不同 locator 指向同一个 DOM 节点
```

处理：

- 合并为同一条候选。
- 保留多个定位方式。

三级合并：

```text
文本、标签、坐标高度相似的重复元素
```

处理：

- 保留代表项。
- 标记“同类重复元素 N 个”。
- 原始记录保留在过滤日志，可恢复。

## 21. 稳定性评分

评分范围：

```text
0 - 100
```

阈值：

- 80-100：高稳定性，默认推荐保存，排序靠前。
- 60-79：中稳定性，展示但不一定默认选中。
- 0-59：低稳定性，默认不推荐，进入低稳定性区或过滤日志。

评分依据：

- locator 唯一性。
- 是否通过真机验证。
- 是否可见。
- 是否可交互。
- locator 类型。
- 文本稳定性。
- 是否依赖动态 class。
- 是否命中 Element Plus 内部包装节点。
- 是否多匹配。
- 是否在 iframe / shadowDOM 中。

## 22. 候选排序与批量操作

默认排序：

1. 稳定性评分降序。
2. 真机验证通过。
3. 未验证。
4. 验证失败。
5. 低稳定性。

候选列表支持：

- 批量勾选。
- 批量取消。
- 批量修改分组。
- 批量删除。
- 一键选择推荐保存项。
- 一键取消低稳定性 / 多匹配 / 未找到项。

## 23. 校验结果增量更新

Runner 支持分批回传校验结果。

好处：

- 大量候选时不用等待全部验证完成。
- 前端可以增量展示已验证候选。
- 用户能看到处理进度，不会误以为系统卡住。

## 24. 截图与坐标规范

为了后续支持“全局截图中高亮元素”，截图坐标必须统一。

保存字段：

```text
boundingBox
scrollX
scrollY
viewportWidth
viewportHeight
deviceScaleFactor
screenshotType
```

局部截图基准：

```text
元素完整边界 + 页面滚动偏移
```

全局截图和局部截图坐标必须可对齐。

## 25. 素材上传与存储

采集素材可能很大，需要预留压缩和分片能力。

建议：

- DOM 使用 gzip。
- 截图使用 jpeg / webp。
- 大文件按 `taskId + partNo` 分片上传。
- 后端合并分片。
- 单任务设置大小上限。
- 上传失败支持重试。

一期可以先做普通 JSON 上传，产品化阶段补压缩和分片。

## 26. 敏感数据脱敏预留

原始快照和截图可能包含：

- 手机号。
- 身份证。
- 银行卡。
- 订单号。
- 客户名称。
- 业务敏感文本。

后端存储层预留脱敏能力：

- 可见文本脱敏。
- DOM 属性脱敏。
- 截图敏感区域遮罩，后续增强。
- 配置项默认关闭，企业合规场景可开启。

## 27. AI 职责边界

AI 可以做：

- 元素命名。
- 分组建议。
- 业务含义解释。
- 噪声元素判断。
- locator 优化建议。
- 补充规则漏掉的候选 locator。

AI 不能做：

- 直接决定元素一定可用。
- 直接绕过验证入库。
- 直接操作浏览器。
- 直接管理状态机。
- 直接替代规则过滤。

确定性流程必须由程序保证，AI 只做增强判断。

## 28. AI 连接池关系

AI 采集模型从系统 AI 连接池中选择。

前端字段：

- AI 采集模型，必填。

后端保存：

- aiModelConfigId。
- aiProvider。
- aiModelName。
- promptVersion。

好处：

- 不把模型写死在前端。
- 后续可切换 OpenAI、通义、智谱、DeepSeek、私有模型等。
- 报告和任务可追溯当时使用的模型和提示词版本。

提示词建议放后端管理，不写死在前端。

## 29. 数据表建议

### 29.1 采集任务表

字段建议：

```text
id
workspaceId
moduleId
pageObjectId
runnerId
sessionId
status
sourceUrl
actualUrl
pageTitle
aiModelConfigId
rawSnapshotPath
globalScreenshotPath
rawCount
finalCount
degradeReason
errorMessage
idempotencyKey
createdAt
snapshotUploadedAt
aiProcessStartedAt
aiProcessFinishedAt
validationStartedAt
validationFinishedAt
completedAt
canceledAt
```

### 29.2 候选元素表

字段建议：

```text
id
taskId
sourceType
name
groupName
locatorType
locatorValue
alternativeLocators
frameChain
shadowPath
stabilityScore
validationStatus
matchCount
visible
clickable
inputable
selectable
boundingBox
localScreenshotPath
aiDescription
filterReason
recommended
verifyCount
lastVerifiedAt
createdAt
```

### 29.3 元素版本表

字段建议：

```text
id
elementId
versionNo
sourceTaskId
sourceCandidateId
locatorType
locatorValue
alternativeLocators
stabilityScore
validationSummary
createdAt
createdBy
active
```

## 30. 一期目标包裁剪边界

目标包 1 只做最小闭环，不做重型架构。

目标包 1 不做：

- 不做 TTL 会话保留，采集上传完成后直接释放浏览器。
- 不做 Runner 心跳上报。
- 不做 WebSocket，全量走 HTTP 轮询。
- 不做真机校验闭环。
- 不做 AI 补充候选。
- 不做 AI 分组解释。
- 不做过滤日志恢复。
- 不引入 MQ。

目标包 1 要做：

- 前端抽屉改成“本地 Runner 采集当前页”。
- URL 改为可选。
- 展示 Runner 当前 URL / title。
- Runner 采集真实页面 DOM / URL / title / 可见文本 / 截图。
- 后端创建任务并保存快照。
- 后端基础规则过滤。
- 前端展示静态候选。
- 候选标记为“静态生成 / 未真机验证”。
- 后端异步可先用线程池 + 任务表轮询。

这样先跑通链路，再逐步升级 AI、验证、TTL、心跳。

## 31. 后续目标包拆分

### 31.1 目标包 1：采集抽屉重设计 + 任务最小闭环

目标：

- 改造采集抽屉。
- 明确“采集当前页”语义。
- URL 仅作为打开页面的辅助输入。
- 后端创建 taskId。
- 保存原始快照。
- 展示静态候选。

### 31.2 目标包 2：后端规则过滤与任务进度

目标：

- 规则过滤无意义元素。
- 去重合并。
- 稳定性评分。
- 分阶段进度展示。
- 过滤统计展示。
- 候选默认排序。
- 批量操作。

### 31.3 目标包 3：AI 处理接入

目标：

- 接 AI 连接池。
- AI 命名。
- AI 分组建议。
- AI 语义解释。
- AI 噪声过滤。
- AI 补充候选。
- AI 输出静态校验和数量限流。

### 31.4 目标包 4：Runner 真机验证闭环

目标：

- 后端下发待验证 locator。
- Runner 批量验证。
- 支持 iframe / shadowDOM。
- 自动滚动后校验。
- 分批回传校验结果。
- 前端增量展示。
- 候选区分 PASSED / FAILED / MULTIPLE / UNVERIFIED。

### 31.5 目标包 5：TTL、心跳、降级、取消、恢复

目标：

- TTL 会话保留。
- Runner 心跳。
- WebSocket + 轮询兜底。
- 任务取消全链路。
- 校验超时重试。
- 过滤日志恢复。
- 降级提示。

### 31.6 目标包 6：产品化与安全增强

目标：

- Runner token 绑定。
- 本地服务安全加固。
- 素材压缩与分片。
- 敏感数据脱敏。
- 多浏览器内核配置。
- Runner 打包为桌面程序。

## 32. 关键开发原则

1. 不再继续把复杂功能堆进大文件。
2. 新增复杂功能前先拆边界。
3. Runner、前端抽屉、后端任务、AI 处理、元素入库分别独立。
4. 状态机、幂等、重试、超时、降级必须由程序控制，不交给 AI 判断。
5. AI 输出必须可追溯、可解释、可回退。
6. 一期先跑通最小闭环，不一次性实现完整最终态。

## 33. 最终结论

最终方案采用：

```text
Local Runner 本地采集真实页面
  + 后端任务化处理
  + 规则过滤和稳定性评分
  + AI 增强命名 / 分组 / 补充候选
  + Runner 本地真机验证
  + 元素库版本化入库
```

这是当前最适合企业 Web UI 自动化元素采集的方案。

它兼顾：

- 登录和鉴权场景。
- 内网访问。
- 验证码和扫码。
- AI 智能增强。
- 真机验证准确性。
- 数据一致性。
- 后续可维护性。
- 一期可落地性。

开发时必须按目标包逐步推进，第一阶段只完成最小闭环，后续再逐步加入 AI、真机验证、TTL、心跳和产品化能力。
