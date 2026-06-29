# 前端大文件治理基线

## 目标

避免新前端继续形成上万行单文件。历史大文件允许短期存在，但后续只允许两类改动：

- 修复当前问题的最小增量改动。
- 从大文件中抽取稳定边界到独立组件、composable 或工具模块。

## 扫描命令

```bash
npm run quality:large-files
```

默认阈值：

- 单文件行数大于等于 800 行。
- 或单文件体积大于等于 80 KB。

可在命令前通过环境变量临时调整：

```bash
MAX_LARGE_FILE_LINES=1000 MAX_LARGE_FILE_KB=120 npm run quality:large-files
```

## 治理规则

1. 不再向超阈值文件新增大块功能。
2. 需要改超阈值文件时，先备份目标文件，再做最小增量改动。
3. 抽取顺序优先选择边界清楚、状态输入输出明确的区域。
4. 每次抽取只做一个职责边界，抽取后必须跑类型检查或构建。
5. 中文源码和文案文件禁止整文件重写，优先使用小范围 patch。

## 当前优先级

1. `src/widgets/api-interface-workspace/ApiInterfaceWorkspace.vue`
2. `src/widgets/api-scenario-workspace/ApiScenarioWorkspace.vue`
3. `src/widgets/web-ui-case-workspace/WebUiElementLibraryPanel.vue`
4. `src/widgets/api-execution-workspace/ApiExecutionWorkspace.vue`

## 接口工作区拆分方向

优先从接口目录树开始拆分，因为它的职责相对独立：

- 目录树展示组件。
- 目录树构建工具。
- 模块懒加载状态和展开状态。
- 请求编辑区、用例区、定义区后续再分别抽取。

