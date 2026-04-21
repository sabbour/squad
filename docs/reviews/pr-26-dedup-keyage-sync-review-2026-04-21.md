# PR #26 Review — H-09 Sync Resolver + H-12 Dedup + H-14 Key Age

**Reviewer:** Flight (Lead)  
**Date:** 2026-04-21  
**PR:** https://github.com/sabbour/squad/pull/26  
**Branch:** `squad/identity-dedup-key-age-sync` → `dev`  
**Author:** EECOM (Core Dev)  
**Verdict:** ✅ **APPROVE**

---

## Summary

Three identity hardening items from the roadmap, bundled in one PR to avoid merge churn on `tokens.ts`. 12 files changed, +693 / −17 lines. Single squash commit `069f2d6e` on top of `dev` HEAD. Build green. 177 identity tests pass (15 files, 0 failures) including 17 new tests across 3 new test files.

---

## Hard Checks

### H-12 — Concurrent Same-Role Dedup

| # | Check | Result |
|---|-------|--------|
| 1 | In-flight keyed by `${squadDir}:${roleKey}` (same as cache key) | ✅ Pass |
| 2 | Release on success AND failure via `.finally(() => inFlight.delete(cacheKey))` | ✅ Pass |
| 3 | Layered: cache hit returns early → inFlight only touched on miss → fetch → store cache → delete inFlight | ✅ Pass |
| 4 | No deadlock: `resolveTokenInternal` is async — `.finally` always runs even on sync throw | ✅ Pass |
| 5 | Tests: concurrent callers → single fetch (✓), error → both null + inFlight cleared + next call fresh (✓), cache hit bypasses inFlight (✓), different roles not deduped (✓), diagnostics path parity (✓) | ✅ Pass |

**Design quality:** Clean extraction of `resolveTokenInternal` keeps the dedup wrapper minimal. The `SQUAD_IDENTITY_MOCK` hook is checked before dedup so mock tests don't pollute the inFlight map.

### H-14 — Key Age Warnings

| # | Check | Result |
|---|-------|--------|
| 6 | `getKeyAgeDays(role)` returns `null` when PEM missing or `stat` fails — `existsSync` guard + try/catch | ✅ Pass |
| 7 | Thresholds: doctor warns ≥60d, fails ≥`SQUAD_IDENTITY_KEY_MAX_AGE_DAYS` (default 90). Env-var override parses with `Number()`, rejects non-positive/non-finite | ✅ Pass |
| 8 | Status inline: dim <60d, yellow ≥60d, red ≥max. Age display only shown when `keyExists && ageDays !== null` | ✅ Pass |
| 9 | Roles without PEMs: status skips age when `!keyExists`; doctor returns `{ skipped: true }` when `!existsSync(pemPath)` | ✅ Pass |

**Design note:** Using file `mtime` instead of a `createdAt` JSON field (roadmap's original proposal) is the better call — zero schema change, works retroactively on keys created before this feature, and can't drift from the actual file on disk. Documented in `eecom-h14-key-age.md` decision.

### H-09 — Sync Cache-Only Resolver

| # | Check | Result |
|---|-------|--------|
| 10 | `resolveTokenSync` is truly sync: `function` (not `async function`), returns `string \| null`, no `await` | ✅ Pass |
| 11 | Cache-only: reads `tokenCache`, respects `REFRESH_MARGIN_MS`, returns `null` on miss. No disk I/O, no JWT sign, no fetch | ✅ Pass |
| 12 | `spawnAgent` flow: tries sync first → null falls through to `await resolveToken` → both paths export `GH_TOKEN`. Lead fallback also uses sync-first pattern | ✅ Pass |
| 13 | Additive: async `resolveToken` signature unchanged. Changeset: `@bradygaster/squad-sdk: minor` (new exports), `@bradygaster/squad-cli: patch` | ✅ Pass |
| 14 | Test: sync returns cached token after prior async warm-up (✓), returns `null` on miss with no network (✓), returns `null` when within refresh margin (✓), works without registration/PEM on disk (✓), mock parity (✓), return type is not a Promise (✓) | ✅ Pass |

### Cross-Cutting

| # | Check | Result |
|---|-------|--------|
| 15 | Token leakage: `debugLog` reports `'resolved' \| 'none'`, never token values. Status/doctor show age, not tokens | ✅ Pass |
| 16 | Changeset names: `@bradygaster/squad-sdk: minor`, `@bradygaster/squad-cli: patch` — correct namespace | ✅ Pass |
| 17 | Scope: `resolve-token.mjs` templates untouched (FIDO's lane). `docs/identity/` untouched (McWriter's lane). Verified by diff search | ✅ Pass |
| 18 | Build + tests: `npm run build` green. `npx vitest run test/identity/ --reporter=dot` → 15 files / 177 tests / 0 failures | ✅ Pass |
| 19 | Lost work: single squash commit `069f2d6e` on `dev` HEAD `7829f6ec`. No gaps, no missing files. EECOM noted "concurrent session switched the working tree mid-edit once — reapplied cleanly." All referenced test files present and consistent | ✅ Pass |

---

## Blockers

None.

---

## Nits (non-blocking)

**N-1 — PR body test count.** PR body states "18 files / 194 tests" but actual run yields 15 files / 177 tests. The 17 new tests are all present. Likely a stale count from a broader run or different environment. Cosmetic only — no missing tests.

**N-2 — Key-age env override test is semantic, not integration.** `key-age.test.ts` verifies that a 45-day-old key's age exceeds a `SQUAD_IDENTITY_KEY_MAX_AGE_DAYS=30` override by comparing values, but doesn't test the doctor command output with the override set. The `getKeyAgeMaxDays()` function is 5 lines of straightforward parsing, so this is very low risk. Non-blocking.

---

## Call-Outs (positive)

1. **`resolveTokenInternal` extraction** — clean separation keeps the dedup wrapper at ~8 lines. Easy to reason about.
2. **`mtime` over `createdAt` schema change** — zero migration cost, works retroactively. Correct decision.
3. **Sync-first fallthrough in spawn.ts** — removes microtask latency on the hot path without changing any observable behaviour. The lead fallback also uses the sync-first pattern consistently.
4. **Negative-age guard** `if (ageMs < 0) return 0` — handles clock skew / future mtimes gracefully.
5. **Decision documents** — both `eecom-h12-dedup.md` and `eecom-h14-key-age.md` are clear, well-structured, and capture rationale.

---

## Merge Action

✅ **Approve and merge to `dev`.** All 19 hard checks pass. No blockers. Two cosmetic nits flagged for awareness — neither requires changes before merge.
