# 自动化测试平台前端 2.0

本项目用于重建 `D:\Project\auto\web`，当前阶段只完成初始化、基础目录、路由、样式 token、请求封装和通用 UI 薄封装，不迁移具体业务页面。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Element Plus
- Axios

## 启动

```bash
npm install
npm run dev
```

默认后端接口地址：

```text
VITE_API_BASE_URL=http://localhost:8080/api
```

可参考 `.env.example` 创建本地环境配置。

## 构建与检查

```bash
npm run typecheck
npm run build
```

`npm run build` 会先执行 `vue-tsc -b`，再执行 Vite 构建。

## 目录结构

```text
src/
  app/          # 应用入口、provider、router、layout
  shared/       # 通用样式、API 基础设施、通用 UI、工具、类型
  entities/     # 稳定业务对象的类型、接口、格式化、基础展示组件
  features/     # 单个用户动作，例如新增、编辑、删除、测试连接
  widgets/      # 页面区域组合，例如设置侧栏、表格区、工作台区域
  processes/    # 跨步骤流程，例如 AI 生成流程、接口执行流程
  pages/        # 路由页面组合层，不写复杂业务逻辑
```

## 依赖边界

- `shared` 不依赖业务层，只放跨项目通用能力。
- `entities` 放稳定业务对象，不承载页面流程。
- `features` 只表达一个用户动作。
- `widgets` 组合 entities/features/shared-ui，负责页面区域。
- `processes` 只放跨步骤、跨区域的流程编排。
- `pages` 只做路由级组合，不堆积复杂逻辑和大段 scoped CSS。

## 视觉与交互基线

初始化已接入以下旧项目整理资产：

- `D:\Project\auto\.codex-tokens.css`
- `D:\Project\auto\.codex-ui-style-guide.md`
- `D:\Project\auto\docs\current-frontend-adjustments-inventory.md`

核心原则：

- 保持 Element Plus，不混入 Arco、Naive UI 等其他 UI 库。
- 保留旧项目沉淀的 token、表格、弹窗、抽屉、状态标签、空状态、加载态视觉语言。
- 不直接复制旧项目大文件，尤其是 `ApiAutomationWorkspace.vue`、`SystemSettingsView.vue`、`CaseAiRecordDetailView.vue` 这类高风险大组件。
- 页面 scoped CSS 只处理局部布局，不重复定义按钮、表格、弹窗、抽屉、状态标签等基础视觉。

## 迁移原则

每开始迁移一个业务模块前，先输出该模块的目录拆分方案并确认。迁移时优先复刻旧项目已稳定的视觉和交互结果，而不是复刻旧代码组织。

单个 widget 如果预计超过 800 行，需要先拆分。接口自动化、系统设置、AI 生成详情等复杂模块应优先按 widgets/features/entities/processes 拆解。
