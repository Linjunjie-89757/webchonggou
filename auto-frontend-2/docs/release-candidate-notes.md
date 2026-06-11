# Release Candidate Notes

## Scope

This release candidate covers the rebuilt frontend under `auto-frontend-2`.

Included modules:

- Login and protected route guard
- Config Center
- Case Center
- Defect Management
- Interface Automation
- System Settings
- Web UI Automation placeholder
- APP Automation placeholder

Out of scope for this release candidate:

- Web UI Automation real business workflows
- APP Automation real business workflows
- Full old-frontend visual parity
- Interface automation complex request editor, assertion editor, scenario orchestration, and variable management
- Defect comment creation and attachment upload/download/delete
- Role permission configuration

## Branch And Repository

- Repository root: `D:\perfectproject\newauto`
- Frontend working directory: `D:\perfectproject\newauto\auto-frontend-2`
- Remote: `origin https://github.com/Linjunjie-89757/webchonggou.git`
- Branch: `codex/frontend-rebuild-cases-config`
- Latest release-closure commit before this note: `fe77253 docs: classify release closure risks`

Only `auto-frontend-2` release-candidate files should be submitted for this frontend release line. The outer `WODEZIDONGHUA` directory remains intentionally ignored.

## Verification Summary

Latest verified checks:

- `npm.cmd run typecheck`: passed
- `npm.cmd run build`: passed
- Playwright smoke regression: passed with documented gaps

Known build warnings:

- `@vueuse/core` PURE annotation warning from dependency output
- Chunk size warning over 500 kB

These warnings do not currently block the release candidate because the production build completes successfully.

## Functional Summary

Config Center:

- Environment, parameter, database connection read and mutation workflows were migrated.
- Disposable regression covered create/edit/status/delete style paths.
- Invalid DB connection test currently returns HTTP 400 from backend.

Case Center:

- Workspace, directory, list, filters, pagination, create/edit/detail/delete/status/review/execute/batch update workflows were migrated.
- Disposable regression succeeded for the main case workflows.

Defect Management:

- List, statistics, filters, pagination, create/edit/detail/comments read, assign, transition, and UI alignment were migrated.
- Remaining disposable bug `BUG-005` / `id=5136` exists because backend has no `DELETE /bugs/{id}` endpoint.

Interface Automation:

- Module tree, interface definition list, interface cases, definition/case create-edit, run entry, delete entry, and run history entry were migrated.
- Empty disposable module cleanup was completed through `DELETE /automation/api/definition-modules/{id}`.
- Case-row history smoke still needs a disposable case with run history.

System Settings:

- AI connection pool, AI create/edit/test/delete/models, workspace read/create/edit, member read/manage, and user read panels were migrated.
- Invalid AI provider test currently returns HTTP 400 from backend.
- Role permission, notification, security, and appearance remain placeholders.

Web UI Automation and APP Automation:

- Both routes intentionally show placeholder pages.
- They no longer call automation task APIs from the active navigation path.

## Release Risk Classification

Blocking:

- No frontend release blocker was found after Goals 82-85.

Recommended before wider UAT:

- Backend cleanup support for disposable defect `BUG-005` / `id=5136`.
- One disposable interface automation case with run history for final case-history verification.
- Backend decision on whether AI/DB test failures should stay HTTP 400 or return business `success=false`.

Acceptable known risks for controlled pre-release:

- AI/DB failed connection tests return HTTP 400.
- Build warnings remain but build passes.
- Logged-out route guard emits an expected `/auth/me` 401 console entry.
- `WODEZIDONGHUA` remains dirty outside this frontend release scope.

Later iteration:

- Defect attachment actions and comment creation.
- Defect transition option restrictions based on backend state matrix.
- Interface automation complex editor, assertions, scenarios, variables, and richer reports.
- System role permissions and additional settings categories.
- Full old-frontend UI parity.

## Handoff Notes

For QA:

- Use the Playwright smoke checklist from `docs/verification-risk-register.md`.
- Prefer disposable data for any create/edit/delete verification.
- Do not use real destructive deletes unless the record is explicitly disposable.

For backend:

- Confirm or add defect cleanup support.
- Confirm AI/DB test failure response contract.
- Confirm defect filtering and pagination semantics with multi-page data.
- Confirm interface automation case history behavior with seeded disposable cases.

For product:

- Treat this as the first rebuilt frontend release candidate for the effective modules.
- Web UI Automation and APP Automation are intentionally placeholders.
- Some advanced workflows are documented as later iterations, not release blockers.
