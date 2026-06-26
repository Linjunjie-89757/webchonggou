# 自动化测试公共配置中心与 Mock 服务设计

## 1. 背景与目标

当前平台已经形成两条主要自动化链路：

- 接口自动化：接口管理、场景、执行套件、报告、设置。
- Web UI 自动化：用例、元素、采集任务、运行记录、环境配置、变量集。

后续支付、短信、物流、风控、微信 H5、支付宝等业务测试会同时被接口自动化和 Web UI 自动化使用。Mock 不应该属于接口自动化专属能力，而应该作为平台公共测试资源存在。

本设计目标：

- 统一环境配置、变量集、Mock 服务、执行器、通知、网络代理的职责边界。
- 支持接口自动化和 Web UI 自动化共同消费这些公共配置。
- 支持微信、支付宝等第三方支付场景的 Mock、沙箱、真实少量冒烟分层测试。
- 保持环境配置轻量，不把所有业务配置堆进环境。
- 保持现有接口、场景、执行套件、报告、Web UI 自动化样式和主流程稳定，逐步接入公共配置能力。

## 2. 总体边界

### 2.1 配置中心承载公共资源

配置中心建议包含：

- 环境配置
- 变量集
- Mock 服务
- 执行器配置
- 通知配置
- 网络代理
- 数据库连接，已有能力保留

这些资源具备平台级或空间级复用价值，接口自动化、Web UI 自动化、后续 APP 自动化都可能消费。

### 2.2 执行套件保留自己的 CI/CD

执行套件的 CI/CD 不放配置中心，保留在执行套件详情内：

- 编排
- 定时任务
- CI/CD
- 运行结果

CI/CD 属于某个套件的触发方式和交付配置，不是公共配置。

执行套件 CI/CD 里维护：

- CI 分支
- 流水线 token
- 触发命令
- 命令参数
- Webhook
- 最近触发记录

## 3. 核心概念

### 3.1 环境配置

环境表示“请求或页面运行到哪里”。

环境应保持轻量，只存公共运行上下文：

- 环境名称
- 适用范围：接口自动化、Web UI、通用
- Base URL
- 默认变量集
- 通用 Header
- 默认超时时间
- 是否忽略 SSL
- 可选代理引用
- 状态
- 描述

不建议直接放入环境主字段：

- 支付模式
- 微信网关
- 支付宝网关
- Mock 场景
- CI 分支
- 远程执行器
- 通知规则
- 代理账号密码明文

### 3.2 变量集

变量集表示“一组运行时数据”。

变量集适合存：

- 支付模式：`MOCK`、`SANDBOX`、`REAL`
- 微信网关、支付宝网关
- 商户号
- AppId
- openId
- 支付金额
- 商品 ID
- 回调地址
- 测试账号
- token
- 业务开关

变量字段建议：

- 变量名
- 变量值
- 类型：字符串、数字、布尔、JSON
- 是否敏感
- 描述
- 启用状态

### 3.3 Mock 服务

Mock 服务表示“第三方系统怎么响应”。

Mock 是公共测试资源，不属于接口自动化专属能力。接口自动化、Web UI 自动化、执行套件、CI/CD 都可以选择 Mock 场景。

Mock 服务一期建议包含：

- Mock 应用
- Mock 接口
- Mock 场景
- 调用日志

### 3.4 执行器配置

执行器表示“任务在哪里跑”。

适合放：

- 执行器名称
- 执行器地址
- 在线状态
- 所属空间
- 可执行类型：API、Web UI
- 标签：Windows、Chrome、内网、微信环境
- 并发上限
- 最近心跳

运行时选择：

- 本地后端
- 远程执行器
- CI

### 3.5 通知配置

通知配置表示“结果通知给谁、什么时候通知”。

适合放：

- 通知渠道：企业微信、钉钉、飞书、邮件、Webhook
- 通知规则
- 失败通知策略
- 连续失败阈值
- 通知范围：全局、空间、套件

### 3.6 网络代理

网络代理表示“请求通过哪个网络出口”。

适合放：

- 全局代理
- 代理地址
- 代理端口
- 账号
- 密码，敏感存储
- 启用状态
- 适用空间

环境配置可以引用代理，但不直接保存代理账号密码明文。

## 4. 运行上下文

接口自动化、Web UI 自动化、执行套件运行时统一形成运行上下文：

```text
workspaceCode
environmentId
variableSetId
mockScenarioId
runnerId
runOn
runtimeVariables
triggerSource
branchName
notificationRuleId
```

### 4.1 变量优先级

建议统一变量优先级：

```text
步骤提取变量 / 脚本变量
> 测试数据当前行
> 运行时变量
> Mock 场景变量
> 变量集
> 环境变量
```

说明：

- 步骤提取和脚本变量优先级最高，用于上下游接口传值。
- 场景测试数据当前行用于数据驱动。
- 运行时变量用于手动运行、CI 触发临时覆盖。
- Mock 场景变量用于控制第三方响应。
- 变量集是稳定业务参数。
- 环境变量是基础默认值。

## 5. 配置治理与生命周期

配置中心属于公共资源，不仅要能创建和使用，还要能回答三个问题：

- 这个配置被谁引用？
- 这个配置是谁在什么时候改的？
- 历史报告是否能还原当时使用的配置？

### 5.1 引用关系与删除校验

环境配置、变量集、Mock 场景、网络代理、执行器、通知规则都需要支持引用详情。

引用详情至少展示：

- 被哪些接口用例引用
- 被哪些接口场景引用
- 被哪些执行套件引用
- 被哪些 Web UI 用例引用
- 被哪些环境或变量集间接引用
- 最近使用该配置的执行记录

删除或停用配置时需要做引用校验：

- 无引用：允许删除。
- 有历史引用但无活跃引用：允许软删除，保留历史报告快照。
- 有活跃引用：默认禁止硬删除，提示引用详情；管理员可按策略强制停用，但必须记录变更日志。

一期建议先做“引用详情 + 删除提示 + 软删除”，不做复杂依赖图。

### 5.2 变更日志

配置中心所有核心资源都需要记录变更日志：

- 环境配置
- 变量集
- Mock 应用
- Mock 接口
- Mock 场景
- 执行器配置
- 通知配置
- 网络代理

日志字段建议：

```text
资源类型
资源 ID
资源名称
操作类型：CREATE / UPDATE / DISABLE / ENABLE / DELETE / RESTORE
变更前 JSON
变更后 JSON
变更字段摘要
操作人
操作时间
备注
```

一期不需要做复杂 diff 高亮，但需要能看到“谁改过、改前改后是什么”。

### 5.3 执行快照

变量集完整版本管理可以后置，但执行快照必须从一开始设计。

每次接口自动化、Web UI 自动化、执行套件运行时，应保存本次实际使用的配置快照：

- 环境快照
- 变量集快照
- Mock 场景快照
- 运行时变量快照
- 执行器信息快照

报告读取快照，不读取实时配置。这样变量集后续被修改，历史报告仍能还原当时执行现场。

### 5.4 版本与回滚策略

一期建议：

- 先做执行快照。
- 变更日志保留完整变更前后内容。
- 支持从变更日志人工复制恢复。

二期再做：

- 变量集版本号。
- Mock 场景版本号。
- 一键回滚到上一个版本。
- 历史版本对比。

暂不建议一期做配置灰度 10% 生效。当前阶段“快照 + 变更日志 + 回滚”比灰度更实用。

### 5.5 权限边界

一期复用现有空间权限：

- 当前空间可读资源允许查看。
- 当前空间可写资源允许新增、编辑、删除。
- 敏感值仅管理员或具备权限的用户可查看明文。

二期再细化：

- 普通测试只读。
- 测试负责人可编辑。
- 管理员可删除和回滚。

### 5.6 兼容与迁移

已有接口自动化和 Web UI 自动化正在使用环境、变量集接口，改造必须保持兼容：

- 旧接口继续返回旧字段。
- 新字段通过扩展字段逐步补充。
- 前端先兼容空字段。
- 迁移脚本只补默认值，不破坏历史数据。
- 回滚时旧链路仍可运行。

### 5.7 性能与容量

配置本身数据量不大，一期不引入 Redis 缓存。

Mock 调用日志和执行日志会增长，需要从一期开始设计：

- `created_at` 索引
- `workspace_id` 索引
- `mock_scenario_id` 索引
- `run_id` / `report_id` 索引
- 默认保留 30 天，后续支持配置化
- 支持按时间清理和手动导出

Redis 缓存、冷热分表、归档策略后置到数据量真实增长后再做。

## 6. 配置中心菜单设计

建议配置中心结构：

```text
配置中心
├─ 环境配置
├─ 变量集
├─ Mock 服务
├─ 执行器配置
├─ 通知配置
├─ 网络代理
└─ 数据库连接
```

### 6.1 环境配置页面

列表字段：

- 环境名称
- 适用范围
- Base URL
- 默认变量集
- Timeout
- SSL
- 代理
- 状态
- 更新时间
- 操作

编辑表单：

- 基础信息
  - 环境名称
  - 适用范围
  - Base URL
  - 描述
- 默认上下文
  - 默认变量集
  - 通用 Header
  - 默认超时时间
  - 忽略 SSL
  - 代理引用
- 状态
  - 启用、停用

### 6.2 变量集页面

列表字段：

- 变量集名称
- 类型
- 变量数量
- 敏感变量数量
- 状态
- 更新时间
- 操作

详情页：

- 变量集基础信息
- 变量表格
  - 变量名
  - 变量值
  - 类型
- 是否敏感
- 描述
- 启用状态
- JSON 导入导出
- 引用详情
- 变更日志
- 执行快照引用，展示最近使用该变量集的报告

变量集类型建议：

- 接口自动化变量集
- Web UI 变量集
- 通用变量集

一期可以继续兼容现有 `API_VARIABLE_SET` 和 `WEB_UI_VARIABLE_SET`，后续增加 `COMMON_VARIABLE_SET`。

### 6.3 Mock 服务页面

一级页面内建议使用三级 tab：

- Mock 应用
- Mock 场景
- 调用日志

#### Mock 应用

字段：

- 应用名称
- 应用编码
- Base Path
- 所属空间
- 状态
- 描述

示例：

```text
微信支付
支付宝支付
短信服务
物流服务
风控服务
```

#### Mock 接口

属于某个 Mock 应用。

字段：

- 请求方法
- 请求路径
- 匹配规则
- 匹配优先级
- 响应状态码
- 响应 Header
- 响应 Body
- 延迟时间
- 是否启用

匹配规则一期模型要预留多维条件，即使 UI 第一版只开放简单配置：

```json
{
  "operator": "AND",
  "conditions": [
    {
      "source": "QUERY",
      "name": "out_trade_no",
      "operator": "EQUALS",
      "value": "${orderNo}"
    },
    {
      "source": "HEADER",
      "name": "content-type",
      "operator": "CONTAINS",
      "value": "application/json"
    },
    {
      "source": "BODY",
      "expression": "$.amount",
      "operator": "REGEX",
      "value": "^[0-9]+$"
    }
  ]
}
```

支持的匹配来源预留：

- Query
- Header
- Cookie
- Body JSONPath
- Body XPath
- Body Regex

支持的匹配操作预留：

- Equals
- Contains
- StartsWith
- EndsWith
- Regex
- Exists

响应 Body 支持变量替换：

```json
{
  "code": "SUCCESS",
  "prepay_id": "${mock_prepay_id}",
  "trade_no": "${mock_trade_no}"
}
```

#### Mock 场景

Mock 场景是一组 Mock 接口行为。

示例：

```text
微信支付成功
微信支付失败
微信支付取消
微信支付超时
微信重复回调
支付宝支付成功
支付宝验签失败
```

字段：

- 场景名称
- 场景编码
- 关联 Mock 应用
- 场景变量
- 关联 Mock 接口规则
- 回调动作
- 引用详情
- 变更日志
- 状态

Mock 场景一期先承载单应用场景。多 Mock 应用组合后置，不在一期实现复杂编排，避免和接口场景、执行套件编排能力重复。

可以预置常用模板：

- 支付成功
- 支付失败
- 支付取消
- 支付超时
- 重复回调
- 验签失败

#### 调用日志

字段：

- 调用时间
- Mock 应用
- Mock 场景
- 请求方法
- 请求路径
- 请求参数
- 响应内容
- 命中规则
- 关联执行任务
- 关联报告
- 耗时
- 结果
- 保留截止时间
- 清理状态

## 7. 接口自动化使用方式

接口自动化运行入口支持选择：

- 环境
- 变量集
- Mock 场景
- 运行于

场景示例：

```text
1. 创建订单
2. 调用支付下单接口
3. Mock 服务模拟微信支付成功回调
4. 查询订单状态
5. 断言订单已支付
```

执行套件示例：

```text
套件：订单冒烟-Mock
环境：订单测试环境
变量集：微信测试商户A
Mock 场景：微信支付成功
```

报告需要记录：

- 环境名称
- 变量集名称
- Mock 场景名称
- 环境快照
- 变量集快照
- Mock 场景快照
- Mock 调用日志入口

## 8. Web UI 自动化使用方式

Web UI 自动化运行入口支持选择：

- 环境
- 变量集
- Mock 场景
- 执行器
- 是否无头

支付链路示例：

```text
1. 打开微信 H5 下单页
2. 选择商品
3. 提交订单
4. 点击支付
5. 进入 Mock 收银台
6. 点击支付成功
7. 返回订单页
8. 断言页面显示支付成功
9. 后台接口校验订单状态
```

Web UI 不建议只在浏览器层拦截请求来 Mock。更推荐业务后端走 Mock 支付通道，这样页面、后端订单、支付流水、回调都能闭环。

## 9. 后端数据模型建议

### 9.1 复用现有表

现有表：

```text
tb_env_config
tb_param_set
```

建议继续复用。

环境扩展优先放入 `config_json`，减少迁移震荡：

```json
{
  "headers": [],
  "authConfig": {},
  "timeoutMs": 10000,
  "variables": [],
  "defaultVariableSetId": 1,
  "ignoreSsl": true,
  "proxyId": 10,
  "scope": "COMMON"
}
```

变量集扩展优先放入 `content_json`：

```json
[
  {
    "key": "merchantId",
    "value": "mock_mch_001",
    "type": "STRING",
    "sensitive": false,
    "description": "测试商户号",
    "enabled": true
  }
]
```

### 9.2 新增 Mock 表

建议新增：

```text
tb_mock_app
tb_mock_endpoint
tb_mock_scenario
tb_mock_scenario_endpoint
tb_mock_call_log
tb_config_change_log
```

#### tb_mock_app

```text
id
workspace_id
app_name
app_code
base_path
description
status
created_at
updated_at
```

#### tb_mock_endpoint

```text
id
workspace_id
mock_app_id
method
path
match_rule_json
priority
response_status
response_headers_json
response_body
delay_ms
status
created_at
updated_at
```

#### tb_mock_scenario

```text
id
workspace_id
scenario_name
scenario_code
mock_app_id
variables_json
description
status
created_at
updated_at
```

#### tb_mock_scenario_endpoint

```text
id
workspace_id
mock_scenario_id
mock_endpoint_id
override_response_status
override_response_headers_json
override_response_body
override_delay_ms
sort_order
status
created_at
updated_at
```

#### tb_mock_call_log

```text
id
workspace_id
mock_app_id
mock_scenario_id
mock_endpoint_id
run_id
report_id
request_method
request_path
request_headers_json
request_body
response_status
response_body
matched
duration_ms
expire_at
cleaned
created_at
```

索引建议：

```text
idx_mock_call_workspace_created_at(workspace_id, created_at)
idx_mock_call_scenario_created_at(mock_scenario_id, created_at)
idx_mock_call_report_id(report_id)
idx_mock_call_run_id(run_id)
idx_mock_call_endpoint_id(mock_endpoint_id)
```

#### tb_config_change_log

```text
id
workspace_id
resource_type
resource_id
resource_name
operation_type
before_json
after_json
summary
operator_id
operator_name
remark
created_at
```

索引建议：

```text
idx_config_change_resource(resource_type, resource_id, created_at)
idx_config_change_workspace_created_at(workspace_id, created_at)
```

### 9.3 引用关系实现建议

引用关系一期不一定新增独立引用表，优先通过现有业务表实时查询：

- 环境被场景、套件、Web UI 用例引用。
- 变量集被环境、场景、套件、Web UI 用例引用。
- Mock 场景被执行配置、场景、套件、Web UI 用例引用。
- 代理被环境引用。
- 执行器被执行计划或运行记录引用。

如果后续引用查询变慢，再新增 `tb_config_reference` 做异步索引。

### 9.4 执行快照存储建议

报告和运行历史应新增或扩展快照字段：

```text
environment_snapshot_json
variable_set_snapshot_json
mock_scenario_snapshot_json
runtime_variables_snapshot_json
runner_snapshot_json
```

一期可以先在报告扩展 JSON 中保存，后续再拆结构化字段。

## 10. 后端接口建议

### 10.1 环境配置

继续复用现有接口，扩展字段：

```text
GET    /api/settings/envs
POST   /api/settings/envs
PUT    /api/settings/envs/{id}
DELETE /api/settings/envs/{id}
```

接口自动化现有：

```text
GET    /api/automation/api/environments
POST   /api/automation/api/environments
PUT    /api/automation/api/environments/{id}
DELETE /api/automation/api/environments/{id}
```

后续建议逐步收口到配置中心公共接口，接口自动化只消费列表。

### 10.2 变量集

继续复用现有配置中心参数接口：

```text
GET    /api/settings/params
POST   /api/settings/params
PUT    /api/settings/params/{id}
DELETE /api/settings/params/{id}
```

接口自动化现有变量集接口保留兼容，后续收口。

### 10.3 Mock 服务

新增：

```text
GET    /api/settings/mock/apps
POST   /api/settings/mock/apps
PUT    /api/settings/mock/apps/{id}
DELETE /api/settings/mock/apps/{id}

GET    /api/settings/mock/apps/{appId}/endpoints
POST   /api/settings/mock/apps/{appId}/endpoints
PUT    /api/settings/mock/endpoints/{id}
DELETE /api/settings/mock/endpoints/{id}

GET    /api/settings/mock/scenarios
POST   /api/settings/mock/scenarios
PUT    /api/settings/mock/scenarios/{id}
DELETE /api/settings/mock/scenarios/{id}

GET    /api/settings/mock/logs
```

引用与变更日志：

```text
GET /api/settings/references?resourceType=VARIABLE_SET&resourceId=1
GET /api/settings/change-logs?resourceType=VARIABLE_SET&resourceId=1
```

Mock 接入网关：

```text
ANY /mock/{appCode}//**
```

## 11. 前端页面建议

### 11.1 配置中心

现有配置中心新增菜单：

```text
环境配置
变量集
Mock 服务
执行器配置
通知配置
网络代理
数据库连接
```

一期新增重点：

- Mock 服务页面
- 环境配置增强字段
- 变量集敏感字段增强
- 引用详情抽屉
- 变更日志抽屉

### 11.2 接口自动化

接口、场景、执行套件运行区域新增 Mock 场景选择：

```text
运行环境
变量集
Mock 场景
运行于
运行 / 保存
```

报告展示：

```text
环境
变量集
Mock 场景
Mock 调用日志
```

### 11.3 Web UI 自动化

用例运行、批量运行、执行器运行入口新增：

```text
运行环境
变量集
Mock 场景
执行器
```

报告展示：

```text
环境
变量集
Mock 场景
执行器
Mock 调用日志
```

## 12. 支付测试落地示例

### 12.1 日常自动化

```text
环境：微信 H5 测试环境
变量集：微信测试商户A
Mock 场景：微信支付成功
执行器：Windows Chrome Runner
```

特点：

- 不真实扣款
- 稳定
- 适合每天回归

### 12.2 沙箱专项

```text
环境：微信沙箱环境
变量集：微信沙箱商户A
Mock 场景：不选择
```

特点：

- 走微信沙箱协议
- 验证签名、网关、回调格式
- 不适合大规模日常回归

### 12.3 真实少量冒烟

```text
环境：生产冒烟环境
变量集：真实小额支付变量集
Mock 场景：不选择
```

特点：

- 只做人工或受控触发
- 适合上线前少量验证
- 不放普通自动化回归

## 13. 分期计划

### V1：公共配置治理与兼容增强

目标：

- 明确配置中心菜单。
- 环境配置支持默认变量集、SSL、代理引用。
- 变量集支持敏感变量、类型、描述。
- 执行入口数据结构预留 `mockScenarioId`。
- 配置引用详情与删除校验。
- 配置变更日志。
- 执行快照字段或扩展 JSON 预留。
- 保持旧接口和旧前端调用兼容。

验证：

- 接口自动化运行不受影响。
- Web UI 自动化运行不受影响。
- 原有环境和变量集可正常回显。
- 删除被引用配置时能提示引用详情。
- 配置变更能查到日志。

### V2：Mock 服务一期

目标：

- 新增 Mock 应用。
- 新增 Mock 接口。
- 新增 Mock 场景。
- 新增 Mock 调用日志。
- 支持固定响应和变量替换。
- Mock 接口预留多维匹配规则和优先级。
- Mock 调用日志具备索引和默认保留策略。

验证：

- 可以创建微信支付成功 Mock 场景。
- 业务系统或自动化步骤能调用 Mock 地址。
- 调用日志可查看。
- Mock 按 method/path/简单条件命中正确响应。

### V3：自动化运行接入 Mock 场景

目标：

- 接口场景运行支持选择 Mock 场景。
- 执行套件运行支持选择 Mock 场景。
- Web UI 用例运行支持选择 Mock 场景。
- 报告记录 Mock 场景和调用日志入口。

验证：

- 接口自动化支付链路跑通。
- Web UI 下单支付链路跑通。
- 报告可追踪 Mock 调用。
- 报告读取本次执行快照，而不是实时配置。

### V4：增强能力

目标：

- 动态脚本响应。
- 复杂匹配规则。
- 回调编排。
- Mock 数据隔离。
- Mock 版本管理。
- 录制真实第三方响应。
- 变量集版本管理和一键回滚。
- 通知模板和分级通知。
- 执行器负载调度和强制终止。
- 配置灰度发布，后置。
- Redis 缓存，后置到真实性能瓶颈出现后。

## 14. 风险与约束

- 环境配置不能膨胀成万能配置桶，业务配置优先放变量集或 Mock 场景。
- Mock 服务是公共能力，不能放在接口自动化专属菜单下。
- 密钥、代理密码、支付证书必须按敏感字段处理，不进入普通报告明文。
- Web UI 支付链路不建议只做浏览器拦截 Mock，应优先让后端走 Mock 支付通道。
- 真实支付只适合少量人工或受控冒烟，不适合日常自动化。
- 报告必须保存本次环境、变量集、Mock 场景快照，否则历史问题难以复现。
- 一期不做变量集继承，避免变量来源过多导致排查困难。
- 一期不引入 Redis 缓存，避免提前复杂化。
- 一期不做配置灰度发布，优先保证快照、日志和回滚路径。
- 执行器负载均衡属于 Runner 目标包，不阻塞 Mock 服务一期。

## 15. 采纳与后置决策

### 15.1 立即采纳

- 配置引用详情。
- 删除和停用引用校验。
- 配置变更日志。
- 执行快照。
- Mock 多维匹配模型预留。
- Mock 调用日志索引和保留策略。
- 旧接口兼容。

### 15.2 部分采纳

- 变量集版本管理：一期先做执行快照，二期做版本和回滚。
- 权限隔离：一期复用空间权限，二期细化角色权限。
- Mock 多应用组合：一期不做复杂组合，先通过场景和套件编排组合。
- 执行器监控和负载均衡：放入 Runner 目标包。
- 通知模板：通知一期先做规则和渠道，模板后置。

### 15.3 后置

- 配置灰度 10% 生效。
- Redis 配置缓存。
- 变量集继承。
- 复杂 Mock 脚本沙箱。

## 16. 建议目标包

目标包名称：

```text
公共测试资源：环境配置、变量集、Mock 服务闭环目标包
```

建议目标：

```text
目标 1：现状审计与兼容边界确认
目标 2：配置中心菜单设计与入口收口
目标 3：环境配置轻量增强
目标 4：变量集敏感字段与类型增强
目标 5：配置引用详情与删除校验
目标 6：配置变更日志
目标 7：执行快照字段预留
目标 8：Mock 服务后端表与接口
目标 9：Mock 服务前端页面
目标 10：Mock 网关、匹配规则与调用日志
目标 11：接口自动化运行接入 Mock 场景
目标 12：Web UI 自动化运行接入 Mock 场景
目标 13：报告展示 Mock 场景、快照与日志入口
目标 14：支付 Mock 示例闭环验收
```
