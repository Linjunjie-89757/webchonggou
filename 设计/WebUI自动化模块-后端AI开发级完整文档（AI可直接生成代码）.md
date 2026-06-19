# WebUI自动化模块\-后端AI开发级完整文档（AI可直接生成代码）

# 0\. 后端全局强制规范（AI开发必须遵守）

## 0\.1 架构核心规则（适配用户现有系统）

- **彻底去除 project 项目维度**，所有数据表、接口、逻辑全部绑定 **spaceId**

- 所有查询自动携带 spaceId 过滤，数据完全空间隔离

- 权限跟随系统空间权限，不单独做权限体系

- 全局能力**禁止重复开发**：AI大模型调用、缺陷管理、MCP、消息通知、用户体系全部复用平台

## 0\.2 后端能力边界（AI必须严格区分）

**平台已有、本模块绝对不重复开发**

- PRD生成手工测试用例、用例评审

- AI基础配置、Key、模型地址、通用AI调用

- 缺陷创建、缺陷模板、MCP推送

- 全局日志、全局通知、用户权限

**本模块独有后端能力（仅此处实现）**

- PRD解析生成【可执行UI自动化用例】后端逻辑

- CDP录制解析 \+ AI优化定位器 \+ 动态ID剔除

- AI全自动生成UI自动化断言（可执行代码级断言）

- 三引擎调度内核（Playwright / Cypress / Selenium）

- 多模态AI诊断（截图\+DOM\+HAR\+日志）

- AI用例自愈、元素自动修复后端逻辑

- UI执行问题智能定级（Bug/环境/脚本）

- 分布式执行任务调度、节点管理

# 1\. 数据库表设计（AI可读、可直接生成Mybatis/Entity）

所有表统一字段：spaceId、createTime、updateTime、deleted

## 1\.1 ui\_page 页面模块表（空间下页面管理）

- id: Long 主键

- spaceId: String 空间ID【隔离核心】

- moduleName: String 模块名称

- pageName: String 页面名称

- sort: Integer 排序

- createTime/updateTime/deleted

## 1\.2 ui\_element UI元素库表

- id: Long

- spaceId: String

- pageId: Long 关联页面ID

- elementName: String 元素名称

- locatorType: String 定位类型 xpath/css/id/name/dataAttr

- locatorValue: String 定位表达式

- description: String 描述

- status: Integer 0失效 1正常

- aiOptimized: Integer 是否AI优化过

- createTime/updateTime/deleted

## 1\.3 ui\_keyword 关键字表

- id: Long

- spaceId: String

- name: String 关键字名称

- type: String 类型 浏览器/元素/断言/等待

- engineType: String 适配引擎 all/playwright/cypress/selenium

- content: Text 关键字脚本内容

- isPublic: Integer 是否公开

- createTime/updateTime/deleted

## 1\.4 ui\_case UI自动化用例表（核心表）

- id: Long

- spaceId: String

- caseName: String 用例名称

- engineType: String 默认执行引擎

- priority: Integer 优先级

- tags: String 标签

- caseSteps: Text 用例步骤JSON（关键字\+元素\+参数）

- aiGenType: String AI生成类型 prd/record/optimize

- lastSuccessRate: Double 最近通过率

- version: Integer 版本号

- createTime/updateTime/deleted

## 1\.5 ui\_suite 场景套件表

- id: Long

- spaceId: String

- suiteName: String 套件名称

- engineType: String 执行引擎

- caseIds: String 关联用例ID集合

- runMode: String 串行/并行

- failStrategy: String 失败策略

- retryCount: Integer 重跑次数

- successRate: Double 成功率

- createTime/updateTime/deleted

## 1\.6 ui\_task 定时任务表

- id: Long

- spaceId: String

- taskName: String 任务名称

- suiteId: Long 关联套件

- cron: String 表达式

- engineType: String 执行引擎

- aiDiagnoseOpen: Integer 是否开启AI诊断

- aiSelfHealOpen: Integer 是否开启AI自愈

- status: Integer 状态

- lastRunTime: Date

- nextRunTime: Date

- createTime/updateTime/deleted

## 1\.7 ui\_report 执行报告主表

- id: Long

- spaceId: String

- suiteId: Long 套件ID

- engineType: String 执行引擎

- env: String 执行环境

- total: Integer 总用例

- success: Integer 成功

- fail: Integer 失败

- passRate: String 通过率

- duration: Long 耗时

- aiClassify: String AI定级 bug/env/script

- aiConclusion: Text AI诊断结论

- bugId: String 关联缺陷ID（复用系统缺陷）

- createTime

## 1\.8 ui\_report\_step 报告步骤详情表

- id: Long

- reportId: Long 报告ID

- caseId: Long 用例ID

- stepNum: Integer 步骤号

- stepName: String 步骤名称

- status: Integer 状态

- log: Text 执行日志

- screenshot: String 截图地址

- domSnapshot: String DOM快照

- harFile: String HAR文件

- duration: Long 耗时

## 1\.9 ui\_config UI专属配置表（空间级）

- id: Long

- spaceId: String

- defaultEngine: String 默认引擎

- windowSize: String 浏览器尺寸

- timeout: Integer 超时时间

- aiSelfHealSwitch: Integer AI自愈开关

- aiSelfHealRetry: Integer 自愈重试次数

- aiAssertLevel: String AI断言严格级别

- screenshotStrategy: String 截图策略

- recordVideo: Integer 是否录屏

- createTime/updateTime

# 2\. 后端全部接口清单（AI可直接生成Controller/Service）

所有接口统一前缀：`/api/v1/webui`

所有接口自动携带 spaceId 上下文

## 2\.1 页面模块接口

- GET /page/list 页面列表

- POST /page/save 新增编辑页面

- DELETE /page/delete 删除页面

## 2\.2 元素库接口（含AI能力）

- GET /element/list

- POST /element/save

- DELETE /element/delete

- POST /element/batch\-import 批量导入

- GET /element/batch\-export 批量导出

- **POST /element/ai\-optimize** AI优化单个定位器

- **POST /element/ai\-batch\-optimize** 批量AI优化

- **POST /element/ai\-self\-heal** AI自愈失效元素

- POST /element/validate 校验元素可用

## 2\.3 关键字接口

- GET /keyword/list

- POST /keyword/save

- DELETE /keyword/delete

- **POST /keyword/ai\-package** AI智能封装关键字

## 2\.4 UI用例接口（核心AI接口）

- GET /case/list

- POST /case/save

- DELETE /case/delete

- POST /case/run 执行单用例

- **POST /case/ai\-gen\-from\-prd** PRD生成自动化用例【核心】

- **POST /case/ai\-record\-optimize** 录制后AI优化步骤

- **POST /case/ai\-assert\-auto** AI自动补全断言

- **POST /case/ai\-optimize\-old** 存量用例一键AI修复

## 2\.5 套件接口

- GET /suite/list

- POST /suite/save

- DELETE /suite/delete

- POST /suite/run 批量执行

- **POST /suite/ai\-assemble** AI智能组装套件

## 2\.6 定时任务接口

- GET /task/list

- POST /task/save

- DELETE /task/delete

- POST /task/start

- POST /task/stop

- POST /task/execute\-once

## 2\.7 报告 \& AI诊断接口

- GET /report/list

- GET /report/detail

- GET /report/step\-list

- **POST /report/ai\-diagnose** 手动触发AI多模态诊断

- **POST /report/ai\-classify** 问题自动定级

## 2\.8 配置接口

- GET /config/get

- POST /config/save

# 3\. 后端核心AI业务逻辑（AI必须严格按此编码）

## 3\.1 PRD生成UI自动化用例 核心逻辑

区别于平台手工用例：

- 输入：PRD文档文件

- AI解析输出：页面结构、操作步骤、校验点、跳转逻辑

- 后端转换逻辑：
        

    1. 拆解每一步浏览器行为

    2. 自动匹配系统关键字

    3. 生成空元素占位

    4. AI自动生成UI可执行断言

    5. 输出完整可执行caseSteps JSON

## 3\.2 AI录制优化逻辑

- 接收CDP原始录制DOM、点击轨迹

- AI识别：动态ID、随机class、临时属性、动态下标

- 自动降级为稳定定位：相对xpath、文本定位、属性模糊匹配

- 清洗冗余步骤、重复点击、无效等待

## 3\.3 AI自动断言逻辑（自动化专属）

不是文本预期，是**可执行校验规则**

- 点击操作后：自动断言元素消失/页面跳转

- 输入操作后：断言输入值回显

- 新增/保存后：断言列表新增数据

- 删除后：断言数据消失

- 查询后：断言列表渲染正常

## 3\.4 AI多模态诊断逻辑（核心差异化）

输入四元组：**日志 \+ 截图 \+ DOM快照 \+ HAR网络**

AI输出固定三类结论：

1. **业务Bug**：页面报错、数据错误、逻辑异常、接口返回错误

2. **环境/网络问题**：超时、404、跨域、服务不可用

3. **脚本/元素问题**：元素移位、DOM更新、定位失效、等待不足

## 3\.5 AI自愈后端逻辑

- 监测用例失败 = 元素找不到

- 自动拉取当前页面最新DOM

- AI语义匹配原元素功能

- 重新生成稳定定位器

- 自动更新元素库 \+ 关联用例步骤

# 4\. 三引擎后端调度规则（AI必须严格遵守）

- **Playwright**：默认通用引擎，支持多窗口、H5、复杂场景、分布式

- **Cypress**：仅SPA/Vue/React项目，自动关闭多窗口能力

- **Selenium**：仅老旧项目、IE兼容

- 用例、套件、任务均可独立指定引擎，优先级：单次执行 \> 套件 \> 全局配置

# 5\. 复用与禁止开发清单（AI防重复必备）

## 5\.1 100%复用，禁止开发

- AI大模型调用工具类、Prompt管理

- 缺陷提交、缺陷绑定、缺陷状态同步

- MCP协议推送、消息通知

- 用户、角色、权限、空间鉴权

- 文件上传、日志存储

## 5\.2 必须本模块开发

- UI自动化AI业务逻辑（自愈、诊断、断言、生成用例）

- 三引擎执行调度

- 元素智能优化

- 多模态数据采集与解析

- UI执行报告AI分析

# 6\. AI开发适配总结

本文档**完全AI可读、AI可直接生成全套后端代码**：

- 数据表齐全 → AI可生成 Entity、Mapper、SQL

- 接口齐全 → AI可生成 Controller、Service

- AI核心逻辑标准化 → 不会写偏、不会漏功能

- 强边界约束 → 不会和现有系统重复冲突

- 完全适配空间架构 → 无项目字段、数据隔离正确

> （注：部分内容可能由 AI 生成）
