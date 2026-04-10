# EECOM

> Environmental, Electrical, and Consumables Manager

📌 **Archived:** History exceeds 15KB. Full history preserved in `history-archive.md`. Session log: 2026-04-10T18:35:28Z.

## Learnings

### Token lifecycle — implementation notes (2025-07-25)
- `generateAppJWT` uses `node:crypto` `createSign('RSA-SHA256')` — no jsonwebtoken dependency needed.
- JWT payload sets `iat: now - 60` (clock drift) and `exp: now + 600` (GitHub's 10-min max).
- `resolveToken` caches in a module-level `Map<string, CachedToken>`, refreshes when within 10 minutes of expiry.
- `resolveToken` returns `null` gracefully when PEM or app registration is missing — no throws.
- `clearTokenCache()` is exported for test isolation — always call in `afterEach`.
- `squad identity create` uses GitHub App Manifest flow: local HTTP server + redirect callback. No PAT needed.
- The CLI `identity create` command dynamically imports `generateAppJWT` from the SDK to avoid circular deps at module scope.

### GH_TOKEN injection into spawn (2025-07-25)
- `spawnAgent()` now calls `resolveRoleSlug(role)` → `resolveToken(teamRoot, slug)` before `createSession`.
- Token is injected via `process.env.GH_TOKEN` and restored in a `finally` block (supports both cleanup and previous-value restoration).
- All identity failures are non-fatal: if `resolveToken` returns `null` or throws, spawn proceeds without injection.
- 8 tests cover: token set during session, restore after success/failure, null/throw graceful fallback, role-slug mapping, stub mode with identity.

### Identity module — API design (2025-07-25)
- Storage functions (`loadIdentityConfig`, `saveAppRegistration`, etc.) are **sync** — identity is read at startup before async work. Uses `node:fs` sync APIs, not `node:fs/promises`.
- Storage functions take the **project root** (parent of `.squad/`), not the `.squad/` dir itself. They internally prepend `.squad/identity/`.
- `formatComment` takes a single `{ agentName, role, body }` object — emoji is derived internally from the role via `resolveRoleSlug`.
- `formatCommitMessage` takes `{ agentName, message }` object.
- SDK subpath exports (e.g., `@bradygaster/squad-sdk/identity`) require an entry in `packages/squad-sdk/package.json` `"exports"` map.


## Team Updates (2026-04-10)

### Orchestration Complete (2026-04-10T20:11:04Z)
- **Event:** Identity module Phase 1 MVP completion + test suite + decision merge
- **Status:** ✅ All deliverables committed
- **Decisions merged:** Fork-based workflow (GitHub App identity on forks, not upstream), Copilot CLI integration (auth context switching for spawned agents), identity storage sync functions
- **Cross-team:** FIDO completed 34 test cases. All tests passing.
- **Flight update:** Proposal updated with fork-based workflow section and Copilot CLI integration architecture (GH_TOKEN injection via SquadGitHubClient). Ready for CONTROL security review.
- **Next phase:** GitHub App token context switching (Phase 2) — requires Copilot CLI integration work

### Spawn Cycle Complete (2026-04-10T20:49:55Z)
- **Event:** GH_TOKEN injection spawn cycle + auto-install + issue triage
- **Status:** ✅ eecom-2 (GH_TOKEN wiring) and eecom-4 (auto-install) delivered
- **Coordinator:** Triaged issues #2-#7, closed #3 (already implemented), assigned #4-#7 to EECOM
- **Log:** Session and orchestration logs written
- **Next:** Continue with remaining identity issues (#5, #6, #7)

