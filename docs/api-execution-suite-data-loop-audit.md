# API Execution Suite Data Loop Audit

Date: 2026-06-21

## Scope

This audit covers only the API automation execution tab. It compares the old frontend execution tab with the current backend capabilities before implementing the execution-suite data loop.

## Old Frontend Execution Tab

Reference file:

- `D:\Project\auto\web\src\components\ApiAutomationWorkspace.vue`

Useful as visual and interaction baseline:

- Execution workspace shell: left suite directory, central suite content, right execution config panel.
- Suite directory density, search box, title row, folder icons, hover rhythm.
- Suite tab strip, close icon, add icon, more icon.
- Secondary tabs: arrange, schedule, branch, result.
- Arrange list row style for API case and scenario entries.
- Right config card shape, run/save button placement, environment/run-mode/select/switch/stat layout.

Not usable as real data source:

- `executionSuiteTree` is hard-coded sample data.
- `executionSuiteCases` is hard-coded sample data.
- New suite, run suite, save suite, and related actions show pending messages instead of real calls.
- The old execution tab does not define a persisted execution-suite domain model.

Conclusion: copy the old execution tab's visual result and interaction structure, but do not copy its fake data implementation.

## Current Backend Capabilities

Reference package:

- `D:\Project\auto\server\src\main\java\com\company\autoplatform\apiautomation`

Existing API automation capabilities:

- API definitions: list/detail/create/update/delete/debug run.
- API definition modules: list/create/update/move/delete.
- API cases: list/detail/create/update/delete/run/debug run.
- API case run history: list and detail.
- API scenarios: list/detail/create/update/delete/run.
- API scenario modules: list/create/update/move/delete.
- Environments and variable sets.
- Report step results: `GET /api/automation/api/runs/reports/{id}/steps`.

Existing persistence:

- `tb_api_definition`
- `tb_api_definition_case`
- `tb_api_definition_module`
- `tb_api_definition_case_run_history`
- `tb_api_scenario`
- `tb_api_scenario_module`
- `tb_api_run_step_result`

Existing execution engine support:

- API case execution.
- Scenario execution.
- Scenario execution policy: continue on failure, global timeout, retry count, default step wait.
- Step result persistence, request/response snapshots, assertion results, extraction results, processor results.

## Backend Gaps For Execution Tab Data Loop

Missing persisted execution-suite domain:

- Suite module table.
- Suite table.
- Suite item table for API cases and scenarios.
- Suite run history table.
- Suite run history detail projection.

Missing APIs:

- Execution suite module CRUD.
- Execution suite CRUD.
- Suite item arrange CRUD and reorder.
- Suite run endpoint.
- Recent 10 suite run results.
- Suite run detail endpoint.

Missing frontend data layer:

- `entities/api-execution-suite` API wrapper and types.
- Real suite-tree composition from modules + suites.
- Real suite detail loading and tab management.
- Real arrange add/remove/reorder.
- Real config save/run.
- Real result tab history/detail.

## Implementation Direction

The execution tab should be implemented as a real domain layer:

- Workspace -> suite modules -> suites -> suite items.
- Suite items can reference API cases and scenarios.
- Suite run consumes existing case/scenario execution capabilities.
- Recent run results should default to the latest 10 records.
- `ALL` workspace can read aggregate data, but write/run actions must require a concrete workspace.

## Goal 335 Result

No code changes were made to application behavior. This document records the audit conclusion used by goals 336-349.
