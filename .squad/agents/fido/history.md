# FIDO

> Quality Owner — Code Review, Incident Triage, PR Validation

📌 **Archived:** History exceeds 15KB. Full history preserved in `history-archive.md`. Session log: 2026-04-10T18:35:28Z.

## Learnings

### Identity module test patterns (2026-07-16)
- Wrote proactive tests for `packages/squad-sdk/src/identity/` against the proposal spec before implementation landed.
- Import path: `@bradygaster/squad-sdk/identity` — requires an `./identity` export in squad-sdk's package.json `exports` map.
- The proposal spec maps unknown roles to `lead`, but the task spec said `backend` — follow the explicit task directive and note the discrepancy for adjustment later.
- Storage tests use the project-standard temp dir pattern: `mkdtempSync` + `afterEach` cleanup (from `test/build-command.test.ts`).
- Test files: `test/identity/role-slugs.test.ts`, `test/identity/formatting.test.ts`, `test/identity/storage.test.ts`.
