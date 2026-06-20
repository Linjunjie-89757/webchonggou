# Web UI Phase 1 Product Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Web UI automation first-phase product hardening so teammates can safely try cases, runs, reports, templates, CI, and environment variables.

**Architecture:** Keep the current Playwright-first implementation. Improve UX in the Vue Web UI widgets, improve error/report metadata in the Spring Boot Web UI automation module, and document the trial workflow without introducing Selenium/Cypress/recording scope.

**Tech Stack:** Vue 3, Element Plus, TypeScript, Spring Boot, MyBatis-Plus, Flyway, Playwright Java.

---

### Task 1: 18.1 UX Copy And Interaction Consistency

**Files:**
- Modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiCaseWorkspace.vue`
- Modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiCaseEditorDrawer.vue`
- Modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiRunDetailDrawer.vue`
- Modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiEnvironmentPanel.vue`
- Modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiReportShareDialog.vue`

- [ ] Search all Web UI widget files for mojibake patterns including `鍏`, `鐢`, `鎵`, `鐜`, `璇`, `鏆`, `纭`, `绂`, `鍙`, `閲`, `宸`, `缂`, `鎿`, and `€`.
- [ ] Replace visible mojibake with clear Chinese labels, messages, empty states, and confirmations.
- [ ] Normalize table operation columns: expose the main actions, move secondary actions to dropdowns where a row has more than three actions.
- [ ] Normalize drawer and dialog footer button order so cancel is secondary and save/run/share actions are primary.
- [ ] Add small CSS guards for action rows to avoid wrapping and button margin drift.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Run Playwright UI verification for `/automation/web`: login, inspect tabs/stats, open editor drawer, open report drawer, open template library, open share dialog.

### Task 2: 18.2 Execution Stability And Error Readability

**Files:**
- Modify: `D:/Project/auto/server/src/main/java/com/company/autoplatform/webuiautomation/WebUiExecutionEngineSupport.java`
- Modify: `D:/Project/auto/server/src/main/java/com/company/autoplatform/webuiautomation/WebUiPlaywrightBrowserRunner.java`
- Modify: `D:/Project/auto/server/src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationModels.java`
- Modify: `D:/Project/auto/server/src/test/java/com/company/autoplatform/webuiautomation/WebUiAutomationControllerIntegrationTests.java`
- Modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiCaseEditorDrawer.vue`
- Modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiRunDetailDrawer.vue`

- [ ] Inspect current execution failure messages and step result fields.
- [ ] Categorize common failures as page open failure, locator not found, wait timeout, assertion failure, and unexpected execution error.
- [ ] Include step name, action type, locator type, locator value, target value, timeout, and screenshot artifact when available in the failed step evidence shown by the report drawer.
- [ ] Ensure debug run, single run, and batch run buttons are disabled or loading while a request is pending.
- [ ] Keep the existing "locate failed step in editor" path and make its message readable.
- [ ] Add or update backend integration assertions for failure evidence fields where practical.
- [ ] Run `.\mvnw.cmd "-Dtest=WebUiAutomationControllerIntegrationTests" test`.
- [ ] Run `npm.cmd run typecheck`.

### Task 3: 18.3 Report Professionalization

**Files:**
- Modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiRunDetailDrawer.vue`
- Modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiCaseWorkspace.vue`
- Modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiReportShareDialog.vue`
- Modify as needed: `D:/Project/auto/server/src/main/java/com/company/autoplatform/webuiautomation/WebUiAutomationModels.java`

- [ ] Make failed steps visually stronger in run detail and batch detail tables.
- [ ] Add explicit screenshot/evidence indicators and download/open actions where artifacts exist.
- [ ] Improve batch report summary copy for teammate/CI reading: total, success, failed, skipped, duration, and first failure list.
- [ ] Verify deep links and shared report links open the intended run or batch.
- [ ] Run Playwright UI verification for run report, batch report, and report share dialog.

### Task 4: 18.4 Environment And Variable First-Phase Closure

**Files:**
- Inspect/modify: `D:/Project/auto/server/src/main/java/com/company/autoplatform/webuiautomation/WebUiExecutionContextSupport.java`
- Inspect/modify: `D:/Project/auto/server/src/main/java/com/company/autoplatform/webuiautomation/WebUiExecutionDomainService.java`
- Inspect/modify: `D:/Project/auto/server/src/main/java/com/company/autoplatform/webuiautomation/WebUiEnvironmentDomainService.java`
- Inspect/modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiEnvironmentPanel.vue`
- Inspect/modify: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/src/widgets/web-ui-case-workspace/WebUiRunDetailDrawer.vue`

- [ ] Confirm Web UI run context resolves environment variables, variable set variables, runtime variables, and extracted variables in the documented order.
- [ ] Confirm environment default variable set binding is present and usable from Web UI run forms.
- [ ] Confirm execution records store environment name, variable set name, and execution context snapshot.
- [ ] Ensure sensitive variables are masked in UI/report context.
- [ ] Add a concise UI hint explaining inherited environment and variable set behavior.
- [ ] Run backend Web UI integration tests and frontend typecheck.

### Task 5: 18.5 Trial Documentation And Smoke Checklist

**Files:**
- Create or replace: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/docs/web-ui-phase1-trial-guide.md`
- Create: `D:/perfectproject/newautoweb/perfectprojectwebchonggou-main/docs/web-ui-phase1-smoke-checklist.md`

- [ ] Write teammate-facing instructions for creating the first Web UI case.
- [ ] Document common step types and locator selection guidance for CSS, text, role, label, and XPath.
- [ ] Document debugging failures, screenshots, batch run, CI Token usage, and report sharing.
- [ ] Write a smoke checklist covering create case, edit steps, debug run, formal run, report, screenshot download, templates, batch run, CI Token, report share link, and environment variable inheritance.
- [ ] Execute the smoke checklist as far as local data allows and record pass/fail/blocked notes.
- [ ] Run final verification: backend Web UI integration test, frontend Web UI tests, `npm.cmd run typecheck`, `npm.cmd run build`, and selected Playwright UI checks.
