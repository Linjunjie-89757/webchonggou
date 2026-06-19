# WebUI自动化模块\-前端完整开发交付文档（路由\+权限\+页面原型\+Vue结构）

# 0\. 全局前置规则（必须遵守）

## 0\.1 架构规范（适配用户系统）

- 无【项目】概念，所有数据**绑定 spaceId**

- 顶部空间切换自动过滤当前空间数据，页面无需做项目选择

- 复用系统全局：权限体系、AI配置、缺陷中心、MCP、通知

- 所有页面布局统一沿用系统中台布局：顶部筛选栏 \+ 操作按钮区 \+ 表格 \+ 分页

## 0\.2 AI能力全局入口规范

- 所有AI按钮统一UI文案：AI生成、AI优化、AI自愈修复、AI自动补断言、AI诊断

- AI加载状态统一全局loading，统一失败弹窗提示

# 1\. 完整路由配置清单（可直接写入路由表）

父路由：webui\-auto（一级菜单：Web UI 自动化）

|路由路径|页面名称|组件地址|权限标识|
|---|---|---|---|
|/webui\-auto/element|UI元素库|views/webui/element/index\.vue|webui:element|
|/webui\-auto/keyword|关键字管理|views/webui/keyword/index\.vue|webui:keyword|
|/webui\-auto/case|UI用例管理（AI核心页）|views/webui/case/index\.vue|webui:case|
|/webui\-auto/suite|场景套件管理|views/webui/suite/index\.vue|webui:suite|
|/webui\-auto/task|定时任务管理|views/webui/task/index\.vue|webui:task|
|/webui\-auto/report|UI测试报告|views/webui/report/index\.vue|webui:report|
|/webui\-auto/config|UI专属AI与引擎配置|views/webui/config/index\.vue|webui:config|

# 2\. 全模块权限点位清单（精准、可直接配置RBAC）

## 2\.1 页面权限

- webui:element:view 查看元素库

- webui:keyword:view 查看关键字

- webui:case:view 查看UI用例

- webui:suite:view 查看套件

- webui:task:view 查看定时任务

- webui:report:view 查看报告

- webui:config:view 查看配置

## 2\.2 操作权限（新增/编辑/删除/执行/AI能力）

- webui:element:add、webui:element:edit、webui:element:delete、webui:element:ai AI优化/自愈

- webui:keyword:add、webui:keyword:edit、webui:keyword:delete、webui:keyword:ai AI封装

- webui:case:add、webui:case:edit、webui:case:delete、webui:case:run 执行用例

- webui:case:ai\-gen AI生成自动化用例

- webui:case:ai\-record AI录制优化

- webui:case:ai\-assert AI自动补断言

- webui:suite:add、webui:suite:edit、webui:suite:delete、webui:suite:run 批量执行

- webui:task:add、webui:task:edit、webui:task:delete、webui:task:start/stop

- webui:config:edit 修改配置

# 3\. 七大页面 完整文字原型 \+ 组件 \+ 按钮 \+ 弹窗 \+ 字段（可直接交付前端）

## 页面1：UI元素库 /views/webui/element/index\.vue

### 页面结构

左侧：页面树形组件（空间下\-模块\-页面）

右侧：筛选栏 \+ 功能按钮区 \+ 表格 \+ 分页

### 筛选栏组件

- 输入框：元素名称

- 下拉：定位类型（xpath/css/id/name/data\-\*）

- 下拉：状态（正常/失效）

- 按钮：查询、重置

### 功能按钮

- 新增元素

- 批量导入

- 批量导出

- **AI批量优化定位器**

- **AI自愈修复失效元素**

### 表格字段

元素名称、所属页面、定位类型、定位表达式、元素描述、状态、创建时间、操作

### 操作列

编辑、删除、校验元素、AI优化定位

### 弹窗：新增/编辑元素

- 所属页面（树形选择）

- 元素名称（input）

- 定位类型（select）

- 定位表达式（textarea）

- 元素描述（input）

- 按钮：AI优化定位、校验元素、保存、取消

## 页面2：关键字管理 /views/webui/keyword/index\.vue

### 筛选栏

关键字类型、引擎适配、公开/私有、搜索

### 功能按钮

新增自定义关键字、**AI智能封装关键字**、刷新

### 表格字段

关键字名称、类型、适配引擎、公开状态、创建时间、操作

### 弹窗：新增/编辑关键字

名称、类型、适配引擎、步骤编排、参数配置、是否公开

## 页面3：UI用例管理（核心AI页） /views/webui/case/index\.vue

### 顶部AI能力入口（核心差异化）

卡片式快捷操作（独立AI操作区）

- **AI生成自动化用例（PRD导入）**：上传文件、选择执行引擎、生成

- **AI录制创建用例**：启动录制、结束录制、AI自动优化

- **存量用例AI一键优化**

- **AI自动补全断言**

### 筛选栏

用例名称、引擎类型、优先级、标签、创建时间

### 功能按钮

新增用例、批量删除、批量执行

### 表格字段

用例名称、适配引擎、优先级、标签、通过率、创建时间、操作

### 核心弹窗/页面：用例编排页（三栏布局）

- 左栏：关键字树列表

- 中栏：步骤列表（拖拽排序、启用/禁用、条件/循环）

- 右栏：当前页面元素库快捷面板

编排页按钮：保存、单步调试、运行、AI补断言、AI优化用例、版本回溯

## 页面4：场景套件管理 /views/webui/suite/index\.vue

### 筛选栏

套件名称、引擎、创建时间

### 功能按钮

新增套件、**AI智能组装套件**、批量执行

### 表格字段

套件名称、适配引擎、用例数、执行成功率、创建时间、操作

### 套件详情页组件

- 用例池选择

- 已选用例拖拽排序

- 执行策略配置：串行/并行、失败策略、重跑次数

- 环境选择、浏览器选择

## 页面5：定时任务管理 /views/webui/task/index\.vue

### 筛选栏

任务名称、状态、执行引擎

### 功能按钮

新增任务、启动、暂停、立即执行

### 表格字段

任务名称、关联套件、cron表达式、状态、最近执行时间、下次执行时间、操作

### 新增任务弹窗字段

- 任务名称

- 关联套件

- Cron表达式

- 失败AI诊断开关

- 失败AI自愈重跑开关

- 通知策略

## 页面6：UI测试报告 /views/webui/report/index\.vue

### 顶部统计卡片组件

总用例数、成功数、失败数、通过率、执行耗时

### 报告基本信息

执行引擎、执行环境、执行时间、执行人

### 核心独有模块：**AI诊断结论卡片**

- AI问题定级：业务Bug / 环境问题 / 脚本元素问题

- 根因分析文本

- AI修复建议

- 自动打包证据：截图/DOM/HAR/日志

- 复用系统按钮：提交缺陷

### 步骤详情组件

步骤号、步骤名称、执行结果、耗时、日志、截图、回放

## 页面7：UI专属AI与引擎配置 /views/webui/config/index\.vue

纯表单配置页，分组卡片展示

### 卡片1：引擎全局配置

默认执行引擎（Playwright/Cypress/Selenium）、无头模式、窗口尺寸、超时时间

### 卡片2：UI AI策略配置

- AI自愈开关、自愈重试次数

- AI诊断严格级别

- AI自动补断言策略

### 卡片3：截图录屏采集配置

失败强制截图、成功截图、全程录屏、DOM快照采集开关

# 4\. 每个页面标准Vue结构模板（可直接新建文件开发）

所有页面统一Vue3 \+ setup语法糖结构，模板完全一致，降低开发成本

```vue
<template>
  <div class="webui-auto-page">
    <!-- 筛选区域 -->
    <div class="search-form">
      <el-form :model="searchForm" inline>
        // 筛选组件
      </el-form>
    </div>

    <!-- 操作按钮区域 -->
    <div class="btn-group">
      // 普通按钮
      // AI专属按钮
    </div>

    <!-- 表格区域 -->
    <el-table :data="tableData" border stripe>
      // 表格列
    </el-table>

    <!-- 分页 -->
    <el-pagination .../>
  </div>
</template>

<script setup>
// 统一引入、统一spaceId过滤、统一权限判断
// 所有接口自动带 spaceId
</script>

<style scoped>
.webui-auto-page {
  padding: 16px;
}
.search-form {
  margin-bottom: 12px;
}
.btn-group {
  margin-bottom: 12px;
}
</style>
```

# 5\. 关键联动说明（保证不重复、不冲突）

- AI大模型配置、密钥、通用AI参数：**全部复用系统全局**

- 缺陷提交、缺陷模板、MCP联动：**全部复用系统全局**

- 手工用例生成、评审：**复用用例中心**

- 本模块只负责：UI自动化专属AI \+ 执行引擎 \+ 元素管理 \+ 自动化报告诊断

# 6\. 最终交付结论

本文档为**可直接交付前端100%落地**版本：

- 无需前端再设计页面结构

- 无需前端自己梳理路由权限

- 所有弹窗、字段、按钮、AI入口、布局全部定型

- 完全适配你的【空间架构】，零冲突、零重复功能

> （注：部分内容可能由 AI 生成）
